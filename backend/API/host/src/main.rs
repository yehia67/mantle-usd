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

mod cache;
mod elf_server;
mod policy;
mod proof_submitter;
mod types;
mod utils;

use crate::cache::*;
use crate::elf_server::*;
use crate::policy::*;
use crate::proof_submitter::*;
use crate::types::*;
use crate::utils::*;


#[tokio::main]
async fn main() -> Result<()> {
    // Load .env file
    dotenvy::dotenv().ok();
    
    // --- Env vars ---
    let rpc_url = Url::parse(&env::var("RPC_URL")?)?;
    let private_key_hex = env::var("PRIVATE_KEY")?;
    // decode hex into Vec<u8>
    let private_key_bytes = hex::decode(&private_key_hex)?;

    let private_key_array: [u8; 32] = private_key_bytes
        .as_slice()
        .try_into()
        .expect("private key must be exactly 32 bytes");

    let signing_key = SigningKey::from_bytes((&private_key_array).into())?;
    let signer = PrivateKeySigner::from(signing_key);
    
    println!("✅ Serving guest ELF from API (no Pinata needed)");
    
    let guest_program_url = env::var("GUEST_ELF_URL")
        .unwrap_or_else(|_| "https://mantle-usd.onrender.com/guest_elf".to_string());
    let guest_program_url = Url::parse(&guest_program_url)?;

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
        .route("/guest_elf", get(serve_guest_elf))
        .layer(cors)
        .with_state(state.clone());

    let port = env::var("HOST_PORT").expect("HOST_PORT env var must be set");
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    println!("🚀 Axum running on http://0.0.0.0:{}", port);
    println!("📦 Guest ELF URL: {}", state.guest_program_url);
    axum::serve(listener, app).await?;

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
    // Check cache first
    if let Some(cached_response) = get_cached_response(&payload) {
        println!("🎯 Cache hit! Returning cached response");
        return Json(cached_response);
    }

    let preliminary_outcome = evaluate(&payload);
    if !preliminary_outcome.allowed {
        return Json(UserResponse {
            message: preliminary_outcome.reason.clone(),
            outcome: preliminary_outcome,
            proof: None,
        });
    }

    let response = match submit_proof_request(&signer, rpc_url, guest_program_url, Json(payload.clone())).await {
        Ok(resp) => {
            // Cache the successful response
            cache_response(&payload, &resp);
            resp
        }
        Err(e) => {
            eprintln!("❌ Proof submission failed: {:?}", e);
            return Json(UserResponse {
                message: format!("Proof generation failed: {}", e),
                outcome: ComplianceOutcome {
                    user: payload.user.clone(),
                    pool_id: payload.pool_id,
                    allowed: false,
                    reason: format!("System error: {}", e),
                    max_allocation: 0,
                    requested_amount: payload.requested_amount,
                    exposure_musd: payload.exposure_musd,
                },
                proof: None,
            });
        }
    };
    
    response
}
