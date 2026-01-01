use anyhow::Result;
use methods::GUEST_CODE_FOR_ZK_PROOF_ELF;
use once_cell::sync::Lazy;
use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION},
    multipart::{Form, Part},
};
use serde::Deserialize;
use std::env;
use std::sync::Mutex;

static CACHED_CID: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

#[derive(Debug, Deserialize)]
struct PinataResponse {
    data: PinataData,
}

#[derive(Debug, Deserialize)]
pub struct PinataData {
    pub cid: String,
}

pub async fn upload_guest_to_pinata() -> Result<PinataData> {
    {
        let cached = CACHED_CID.lock().unwrap();
        if let Some(cid) = cached.as_ref() {
            println!("✅ Using cached CID from memory (no upload needed)");
            println!("   CID: {}", cid);
            return Ok(PinataData { cid: cid.clone() });
        }
    }

    if let Ok(cid) = env::var("PINATA_CID") {
        if !cid.is_empty() {
            println!("✅ Using CID from PINATA_CID env variable (no upload needed)");
            println!("   CID: {}", cid);
            // Cache it for future requests in this session
            *CACHED_CID.lock().unwrap() = Some(cid.clone());
            return Ok(PinataData { cid });
        }
    }

    let jwt = env::var("PINATA_JWT").expect("PINATA_JWT environment variable must be set");

    println!("📦 No cached CID found - uploading guest ELF to Pinata...");
    println!("   💡 Tip: Set PINATA_CID in .env to skip uploads on restart");

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

    // Cache the CID for future requests
    *CACHED_CID.lock().unwrap() = Some(parsed.data.cid.clone());

    Ok(parsed.data)
}
