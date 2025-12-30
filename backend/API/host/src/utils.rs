use alloy::signers::local::PrivateKeySigner;
use url::Url;

#[derive(Clone)]
pub struct AppState {
    pub signer: PrivateKeySigner,
    pub rpc_url: Url,
    pub guest_program_url: Url,
}
