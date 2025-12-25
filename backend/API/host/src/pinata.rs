use anyhow::Result;
use methods::GUEST_CODE_FOR_ZK_PROOF_ELF;
use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION},
    multipart::{Form, Part},
};
use serde::Deserialize;
use std::env;

#[derive(Debug, Deserialize)]
struct PinataResponse {
    data: PinataData,
}

#[derive(Debug, Deserialize)]
pub struct PinataData {
    pub cid: String,
}

pub async fn upload_guest_to_pinata() -> Result<PinataData> {
    let jwt = env::var("PINATA_JWT").expect("PINATA_JWT environment variable must be set");

    println!("📦 Uploading guest ELF to Pinata…");

    let buffer = Vec::from(GUEST_CODE_FOR_ZK_PROOF_ELF);

    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", jwt))?,
    );

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .build()?;

    let file_part = Part::bytes(buffer)
        .file_name("zk-guest.elf")
        .mime_str("application/octet-stream")?;

    let form = Form::new()
        .part("file", file_part)
        .part("network", Part::text("public"));

    let response = client
        .post("https://uploads.pinata.cloud/v3/files")
        .multipart(form)
        .send()
        .await?;

    if !response.status().is_success() {
        let err = response.text().await?;
        println!("❌ Pinata upload failed: {}", err);
        anyhow::bail!("Pinata upload failed");
    }

    let parsed: PinataResponse = response.json().await?;
    println!("✅ Pinata CID = {}", parsed.data.cid);

    Ok(parsed.data)
}
