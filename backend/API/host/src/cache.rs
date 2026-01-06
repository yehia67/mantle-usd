use crate::types::{ComplianceRequest, UserResponse};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex;

static RESPONSE_CACHE: Lazy<Mutex<HashMap<String, UserResponse>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub fn get_cache_key(request: &ComplianceRequest) -> String {
    format!(
        "{}:{}:{}:{}:{}:{}:{}:{}:{}",
        request.user,
        request.pool_id,
        request.residency,
        request.kyc_level,
        request.aml_passed,
        request.accredited_investor,
        request.exposure_musd,
        request.requested_amount,
        request.risk_score
    )
}

pub fn get_cached_response(request: &ComplianceRequest) -> Option<UserResponse> {
    let key = get_cache_key(request);
    let cache = RESPONSE_CACHE.lock().unwrap();
    cache.get(&key).cloned()
}

pub fn cache_response(request: &ComplianceRequest, response: &UserResponse) {
    let key = get_cache_key(request);
    let mut cache = RESPONSE_CACHE.lock().unwrap();
    cache.insert(key.clone(), response.clone());
    println!("✅ Cached response for key: {}", key);
}
