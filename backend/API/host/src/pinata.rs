use anyhow::Result;
use once_cell::sync::Lazy;
use serde::Deserialize;
use std::env;
use std::sync::Mutex;

static CACHED_CID: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

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

    // If we reach here without a cached CID, PINATA_CID env var must be set
    anyhow::bail!("PINATA_CID environment variable must be set. Guest ELF upload is not supported in production.")
}
