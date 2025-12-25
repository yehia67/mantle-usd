use serde::{Deserialize, Serialize};
use alloy_primitives::U256;

#[derive(Debug, Deserialize)]
pub struct UserRequest {
    pub is_compliant: bool,
}

#[derive(Debug, Serialize)]
pub struct Fulfillment {
    pub journal: Vec<u8>,
    pub seal: Vec<u8>,
    pub id: U256,

    // Human-readable representation
    pub str_format: String,
}

impl Fulfillment {
    pub fn new(journal: Vec<u8>, seal: Vec<u8>, id: U256) -> Self {
        let journal_str = String::from_utf8_lossy(&journal).to_string();
        let seal_str = hex::encode(&seal);
        let id_bytes: [u8; 32] = id.to_be_bytes::<32>();
        let id_str = hex::encode(id_bytes);

        let str_format = format!(
            "📦 Journal: {}\n🔏 Seal (hex): {}\n🆔 ID (hex): {}",
            journal_str, seal_str, id_str
        );

        Self {
            journal,
            seal,
            id,
            str_format,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub proof_fulfillment: Fulfillment,
    pub message: String,
}

impl UserRequest {
    /// Converts request into RISC0 guest stdin
    pub fn to_guest_stdin(&self) -> Vec<u8> {
        let v: u32 = if self.is_compliant { 1 } else { 0 };
        v.to_le_bytes().to_vec()
    }
}
