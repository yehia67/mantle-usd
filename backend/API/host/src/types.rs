use alloy_primitives::U256;
use anyhow::Result;
use risc0_zkvm::serde::{from_slice, to_vec};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PoolId {
    Gold,
    MoneyMarket,
    RealEstate,
}

impl fmt::Display for PoolId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PoolId::Gold => write!(f, "Gold"),
            PoolId::MoneyMarket => write!(f, "Money Market"),
            PoolId::RealEstate => write!(f, "Real Estate"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceRequest {
    pub user: String,
    pub pool_id: PoolId,
    pub residency: String,
    pub kyc_level: u8,
    pub aml_passed: bool,
    pub accredited_investor: bool,
    pub exposure_musd: u64,
    pub requested_amount: u64,
    pub risk_score: u8,
}

impl ComplianceRequest {
    pub fn to_guest_stdin(&self) -> Result<Vec<u8>> {
        let words = to_vec(self)?;
        let mut bytes = Vec::with_capacity(words.len() * 4);
        for word in words {
            bytes.extend_from_slice(&word.to_le_bytes());
        }
        Ok(bytes)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceOutcome {
    pub user: String,
    pub pool_id: PoolId,
    pub allowed: bool,
    pub reason: String,
    pub max_allocation: u64,
    pub requested_amount: u64,
    pub exposure_musd: u64,
}

impl ComplianceOutcome {
    pub fn from_journal(bytes: &[u8]) -> Result<Self> {
        Ok(from_slice(bytes)?)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProofMetadata {
    pub journal: Vec<u8>,
    pub seal: Vec<u8>,
    pub id: U256,
    pub summary: String,
}

impl ProofMetadata {
    pub fn new(outcome: &ComplianceOutcome, journal: Vec<u8>, seal: Vec<u8>, id: U256) -> Self {
        let seal_hex = hex::encode(&seal);
        let id_bytes: [u8; 32] = id.to_be_bytes::<32>();
        let id_hex = hex::encode(id_bytes);
        let summary = format!(
            "{} proof | allowed: {} | reason: {} | request: {} mUSD | exposure: {} mUSD | seal={} | id={}",
            outcome.pool_id,
            outcome.allowed,
            outcome.reason,
            outcome.requested_amount,
            outcome.exposure_musd,
            &seal_hex[0..std::cmp::min(16, seal_hex.len())],
            &id_hex[0..12]
        );

        Self {
            journal,
            seal,
            id,
            summary,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct UserResponse {
    pub outcome: ComplianceOutcome,
    pub proof: Option<ProofMetadata>,
    pub message: String,
}
