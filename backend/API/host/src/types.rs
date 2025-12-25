use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct UserRequest {
    pub is_compliant: bool,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub proof_journal: Vec<u8>,
    pub message: String,
}

impl UserRequest {
    /// Converts request into RISC0 guest stdin
    pub fn to_guest_stdin(&self) -> Vec<u8> {
        let v: u32 = if self.is_compliant { 1 } else { 0 };
        v.to_le_bytes().to_vec()
    }
}

impl UserResponse {
    pub fn to_output(&self) -> String {
        self.proof_journal.iter().map(|b| format!("{:02x}", b)).collect()
    }
}