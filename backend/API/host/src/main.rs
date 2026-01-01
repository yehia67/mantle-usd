use alloy::signers::local::PrivateKeySigner;
use anyhow::Result;
use axum::response::IntoResponse;
use axum::{
    extract::{Json, State},
    routing::{get, post},
    Router,
};
use k256::ecdsa::SigningKey;
use serde_json::json;
use std::{env, sync::Arc};
use tower_http::cors::{CorsLayer, Any};
use url::Url;

mod pinata;
mod policy;
mod proof_submitter;
mod types;
mod utils;

use crate::pinata::*;
use crate::policy::*;
use crate::proof_submitter::*;
use crate::types::*;
use crate::utils::*;


#[tokio::main]
async fn main() -> Result<()> {
    // --- Env vars ---
    let rpc_url = Url::parse(&env::var("RPC_URL")?)?;
    let private_key_hex = env::var("PRIVATE_KEY")?;
    // decode hex into Vec<u8>
    let private_key_bytes = hex::decode(&private_key_hex)?;

    // convert Vec<u8> → [u8; 32]
    let private_key_array: [u8; 32] = private_key_bytes
        .as_slice()
        .try_into()
        .expect("private key must be exactly 32 bytes");

    // now create the SigningKey
    let signing_key = SigningKey::from_bytes((&private_key_array).into())?;
    let signer = PrivateKeySigner::from(signing_key);
    let mut program_cid: String = String::new();
    match upload_guest_to_pinata().await {
        Ok(data) => {
            println!("File uploaded successfully!");
            println!("CID: {}", data.cid);
            program_cid = data.cid;
        }
        Err(err) => eprintln!("Error: {}", err),
    }
    let guest_program_url =
        Url::parse(&format!("https://gateway.pinata.cloud/ipfs/{program_cid}"))?;

    // --- Axum server ---
    let state = Arc::new(AppState {
        signer,
        rpc_url,
        guest_program_url,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(root))
        .route(
            "/validate_user",
            get(get_validate_user).post(post_validate_user_handler),
        )
        .route(
            "/compliance/pools",
            post(post_compliance_pools_handler),
        )
        .layer(cors)
        .with_state(state);

    let port = env::var("HOST_PORT").expect("HOST_PORT env var must be set");
    let address = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&address).await.unwrap();

    println!("🚀 Axum running on http://{address}");

    axum::serve(listener, app).await.unwrap();
    Ok(())
}

// GET /
async fn root() -> Json<serde_json::Value> {
    Json(json!({"message": "Welcome to the compliance API!"}))
}

// GET /validate_user
async fn get_validate_user() -> Json<serde_json::Value> {
    Json(json!({
        "message": "POST /validate_user or /compliance/pools with full compliance payload",
        "schema": {
            "user": "0x...",
            "pool_id": "gold | money_market | real_estate",
            "residency": "ISO country code",
            "kyc_level": "u8 >= 0",
            "aml_passed": "bool",
            "accredited_investor": "bool",
            "exposure_musd": "current exposure in mUSD",
            "requested_amount": "trade amount in mUSD",
            "risk_score": "0-10"
        }
    }))
}

// POST /validate_user
async fn post_validate_user_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ComplianceRequest>,
) -> impl IntoResponse {
    post_validate_user(
        Json(payload),
        &state.signer,
        state.rpc_url.clone(),
        state.guest_program_url.clone(),
    )
    .await
}

async fn post_compliance_pools_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ComplianceRequest>,
) -> impl IntoResponse {
    post_validate_user(
        Json(payload),
        &state.signer,
        state.rpc_url.clone(),
        state.guest_program_url.clone(),
    )
    .await
}

async fn post_validate_user(
    Json(payload): Json<ComplianceRequest>,
    signer: &PrivateKeySigner,
    rpc_url: Url,
    guest_program_url: Url,
) -> Json<UserResponse> {
    let preliminary_outcome = evaluate(&payload);
    if !preliminary_outcome.allowed {
        return Json(UserResponse {
            message: preliminary_outcome.reason.clone(),
            outcome: preliminary_outcome,
            proof: None,
        });
    }

    submit_proof_request(&signer, rpc_url, guest_program_url, Json(payload))
        .await
        .expect("zk proof failed")
}
