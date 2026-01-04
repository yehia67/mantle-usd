use alloy_primitives::U256;
use anyhow::Result;
use risc0_zkvm::serde::{from_slice, to_vec};
use serde::{Deserialize, Serialize};
use std::fmt;
use utoipa::ToSchema;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
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

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(
    example = json!({
        "user": "0x2111222233334444555566667777888899990000",
        "pool_id": "gold",
        "residency": "US",
        "kyc_level": 2,
        "aml_passed": true,
        "accredited_investor": true,
        "exposure_musd": 20000,
        "requested_amount": 10000,
        "risk_score": 3
    })
)]
pub struct ComplianceRequest {
    #[schema(example = "0x2111222233334444555566667777888899990000")]
    pub user: String,
    #[schema(example = "gold")]
    pub pool_id: PoolId,
    #[schema(example = "US")]
    pub residency: String,
    #[schema(example = 2, minimum = 0, maximum = 3)]
    pub kyc_level: u8,
    #[schema(example = true)]
    pub aml_passed: bool,
    #[schema(example = true)]
    pub accredited_investor: bool,
    #[schema(example = 20000)]
    pub exposure_musd: u64,
    #[schema(example = 10000)]
    pub requested_amount: u64,
    #[schema(example = 3, minimum = 0, maximum = 10)]
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

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(
    example = json!({
        "user": "0x2111222233334444555566667777888899990000",
        "pool_id": "gold",
        "allowed": true,
        "reason": "All compliance checks passed",
        "max_allocation": 50000,
        "requested_amount": 10000,
        "exposure_musd": 20000
    })
)]
pub struct ComplianceOutcome {
    #[schema(example = "0x2111222233334444555566667777888899990000")]
    pub user: String,
    #[schema(example = "gold")]
    pub pool_id: PoolId,
    #[schema(example = true)]
    pub allowed: bool,
    #[schema(example = "All compliance checks passed")]
    pub reason: String,
    #[schema(example = 50000)]
    pub max_allocation: u64,
    #[schema(example = 10000)]
    pub requested_amount: u64,
    #[schema(example = 20000)]
    pub exposure_musd: u64,
}

impl ComplianceOutcome {
    pub fn from_journal(bytes: &[u8]) -> Result<Self> {
        Ok(from_slice(bytes)?)
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ProofMetadata {
    #[schema(value_type = String, example = "0xdeadbeef")]
    pub journal: Vec<u8>,
    #[schema(value_type = String, example = "0xcafebabe")]
    pub seal: Vec<u8>,
    #[schema(value_type = String, example = "0x123456789abcdef")]
    pub id: U256,
    #[schema(example = "Gold proof | allowed: true | reason: All compliance checks passed")]
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

#[derive(Debug, Clone, Serialize, ToSchema)]
#[schema(
    example = json!({
        "outcome": {
            "user": "0x2111222233334444555566667777888899990000",
            "pool_id": "gold",
            "allowed": true,
            "reason": "All compliance checks passed",
            "max_allocation": 50000,
            "requested_amount": 10000,
            "exposure_musd": 20000
        },
        "proof": null,
        "message": "Compliance check passed"
    })
)]
pub struct UserResponse {
    pub outcome: ComplianceOutcome,
    pub proof: Option<ProofMetadata>,
    #[schema(example = "Compliance check passed")]
    pub message: String,
}
