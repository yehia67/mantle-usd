use crate::types::{ComplianceOutcome, ComplianceRequest, PoolId};

struct PoolPolicy {
    name: &'static str,
    allowed_residencies: &'static [&'static str],
    banned_residencies: &'static [&'static str],
    max_single_trade: u64,
    max_total_exposure: u64,
    min_kyc_level: u8,
    max_risk_score: u8,
    require_accreditation: bool,
    pool_id: PoolId,
}

const GOLD_ALLOWED: &[&str] = &["US", "CA", "UK", "DE", "FR", "SG", "AE"];
const MONEY_MARKET_ALLOWED: &[&str] = &["US", "CA", "UK", "DE", "FR"];
const REAL_ESTATE_BANNED: &[&str] = &["RU", "KP", "IR", "SY"];

pub fn evaluate(request: &ComplianceRequest) -> ComplianceOutcome {
    let policy = policy_for(request.pool_id);
    let normalized_residency = request.residency.to_ascii_uppercase();

    let mut failures: Vec<String> = Vec::new();

    if !request.aml_passed {
        failures.push("AML screening failed".to_string());
    }

    if normalized_residency.is_empty() {
        failures.push("Residency not provided".to_string());
    } else {
        if !policy.allowed_residencies.is_empty()
            && !contains(policy.allowed_residencies, normalized_residency.as_str())
        {
            failures.push(format!(
                "{} pool is not open to residency {}",
                policy.name, normalized_residency
            ));
        }

        if !policy.banned_residencies.is_empty()
            && contains(policy.banned_residencies, normalized_residency.as_str())
        {
            failures.push(format!(
                "Residency {} is blocked for {} pool",
                normalized_residency, policy.name
            ));
        }
    }

    if request.kyc_level < policy.min_kyc_level {
        failures.push(format!(
            "{} pool requires KYC level {} or higher (provided {})",
            policy.name, policy.min_kyc_level, request.kyc_level
        ));
    }

    if request.risk_score > policy.max_risk_score {
        failures.push(format!(
            "Risk score {} exceeds {} pool limit {}",
            request.risk_score, policy.name, policy.max_risk_score
        ));
    }

    if policy.require_accreditation && !request.accredited_investor {
        failures.push(format!(
            "{} pool is limited to accredited investors",
            policy.name
        ));
    }

    if request.requested_amount > policy.max_single_trade {
        failures.push(format!(
            "Requested amount {} mUSD exceeds {} single-trade limit of {} mUSD",
            request.requested_amount, policy.name, policy.max_single_trade
        ));
    }

    let projected_exposure = request
        .exposure_musd
        .saturating_add(request.requested_amount);
    if projected_exposure > policy.max_total_exposure {
        failures.push(format!(
            "Projected exposure {} mUSD exceeds {} pool cap of {} mUSD",
            projected_exposure, policy.name, policy.max_total_exposure
        ));
    }

    let allowed = failures.is_empty();
    let max_allocation = policy
        .max_total_exposure
        .saturating_sub(request.exposure_musd);
    let reason = if allowed {
        format!(
            "{} pool approval: user may allocate up to {} mUSD more (requested {}).",
            policy.name, max_allocation, request.requested_amount
        )
    } else {
        failures.join(" | ")
    };

    ComplianceOutcome {
        user: request.user.clone(),
        pool_id: policy.pool_id,
        allowed,
        reason,
        max_allocation,
        requested_amount: request.requested_amount,
        exposure_musd: request.exposure_musd,
    }
}

fn policy_for(pool_id: PoolId) -> PoolPolicy {
    match pool_id {
        PoolId::Gold => PoolPolicy {
            name: "Gold",
            allowed_residencies: GOLD_ALLOWED,
            banned_residencies: &[],
            max_single_trade: 50_000,
            max_total_exposure: 150_000,
            min_kyc_level: 2,
            max_risk_score: 4,
            require_accreditation: false,
            pool_id: PoolId::Gold,
        },
        PoolId::MoneyMarket => PoolPolicy {
            name: "Money Market",
            allowed_residencies: MONEY_MARKET_ALLOWED,
            banned_residencies: &[],
            max_single_trade: 25_000,
            max_total_exposure: 50_000,
            min_kyc_level: 3,
            max_risk_score: 3,
            require_accreditation: true,
            pool_id: PoolId::MoneyMarket,
        },
        PoolId::RealEstate => PoolPolicy {
            name: "Real Estate",
            allowed_residencies: &[],
            banned_residencies: REAL_ESTATE_BANNED,
            max_single_trade: 200_000,
            max_total_exposure: 500_000,
            min_kyc_level: 2,
            max_risk_score: 5,
            require_accreditation: true,
            pool_id: PoolId::RealEstate,
        },
    }
}

fn contains(list: &[&str], value: &str) -> bool {
    list.iter().any(|entry| entry.eq_ignore_ascii_case(value))
}
