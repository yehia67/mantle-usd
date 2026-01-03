use axum::response::{IntoResponse, Response};
use axum::body::Body;
use methods::GUEST_CODE_FOR_ZK_PROOF_ELF;

pub async fn serve_guest_elf() -> impl IntoResponse {
    Response::builder()
        .header("Content-Type", "application/octet-stream")
        .header("Content-Disposition", "inline; filename=\"guest.elf\"")
        .body(Body::from(GUEST_CODE_FOR_ZK_PROOF_ELF))
        .unwrap()
}
