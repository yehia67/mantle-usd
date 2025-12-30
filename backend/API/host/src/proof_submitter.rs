// use anyhow::Result;
use crate::types::{UserRequest, UserResponse};
use alloy::signers::local::PrivateKeySigner;
use axum::extract::Json;
use boundless_market::{request_builder::OfferParams, storage::storage_provider_from_env, Client};
use methods::GUEST_CODE_FOR_ZK_PROOF_ID;
use std::time::Duration;
use url::Url;

pub async fn submit_proof_request(
    signer: &PrivateKeySigner,
    rpc_url: Url,
    guest_program_url: Url,
    Json(payload): Json<UserRequest>,
) -> anyhow::Result<Json<UserResponse>> {
    let client = Client::builder()
        .with_rpc_url(rpc_url)
        .with_private_key(signer.clone())
        .with_storage_provider(Some(storage_provider_from_env()?))
        .build()
        .await?;

    println!("🚀 Submitting Boundless request");
    println!("🌍 Program URL = {}", guest_program_url);
    let stdin = payload.to_guest_stdin();

    let request = client
        .new_request()
        .with_program_url(guest_program_url)?
        .with_stdin(stdin)
        .with_image_id(GUEST_CODE_FOR_ZK_PROOF_ID)
        .with_offer(
            OfferParams::builder()
                .ramp_up_period(30)
                .lock_timeout(500)
                .timeout(900),
        );

    let (request_id, expires_at) = client.submit_onchain(request).await?;
    println!("🆔 Request ID = {:?}", request_id);

    let fulfillment_raw = client
        .wait_for_request_fulfillment(request_id, Duration::from_secs(10), expires_at)
        .await?;

    println!(
        "📦 Fulfillment raw: {:?}\n🔏 Seal: {:?}",
        fulfillment_raw.data()?,
        fulfillment_raw.seal
    );
    // Keep data alive
    let data = fulfillment_raw.data()?;
    let journal_bytes = data
        .journal()
        .ok_or_else(|| anyhow::anyhow!("No journal in fulfillment"))?;

    // Decode journal into Vec<u8>
    let journal_vec: Vec<u8> = risc0_zkvm::serde::from_slice(journal_bytes.as_ref())?;

    // Construct Fulfillment struct with human-readable string
    let fulfillment = crate::types::Fulfillment::new(
        journal_vec,
        fulfillment_raw.seal.to_vec(),
        fulfillment_raw.id,
    );

    // Construct the API response
    let response = Json(UserResponse {
        proof_fulfillment: fulfillment,
        message: "Compliance proven with zkVM".to_string(),
    });

    Ok(response)
}
