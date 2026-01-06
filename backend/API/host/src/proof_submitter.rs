use crate::types::{ComplianceOutcome, ComplianceRequest, ProofMetadata, UserResponse};
use alloy::signers::local::PrivateKeySigner;
use axum::extract::Json;
use boundless_market::{request_builder::OfferParams, Client};
use std::time::Duration;
use url::Url;

pub async fn submit_proof_request(
    signer: &PrivateKeySigner,
    rpc_url: Url,
    guest_program_url: Url,
    Json(payload): Json<ComplianceRequest>,
) -> anyhow::Result<Json<UserResponse>> {
    let client = Client::builder()
        .with_rpc_url(rpc_url)
        .with_private_key(signer.clone())
        .build()
        .await?;

    println!("🚀 Submitting Boundless request");
    println!("📦 Using guest ELF from: {}", guest_program_url);
    let stdin = payload.to_guest_stdin()?;

    let request = client
        .new_request()
        .with_program_url(guest_program_url)?
        .with_stdin(stdin)
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

    let outcome = ComplianceOutcome::from_journal(journal_bytes.as_ref())?;
    println!(
        "Compliance decision: pool={} allowed={} reason={}",
        outcome.pool_id, outcome.allowed, outcome.reason
    );

    let proof = ProofMetadata::new(
        &outcome,
        journal_bytes.as_ref().to_vec(),
        fulfillment_raw.seal.to_vec(),
        fulfillment_raw.id,
    );

    let response = Json(UserResponse {
        outcome,
        proof: Some(proof),
        message: "Compliance evaluation completed via zkVM proof".to_string(),
    });

    Ok(response)
}
