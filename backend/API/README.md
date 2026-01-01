# Mantle USD Compliance API

This crate hosts the Axum service that orchestrates zk-compliance proofs for Mantle USD.  
It does three things:

1. Uploads the compiled RISC Zero guest ELF to Pinata to obtain an IPFS URL the Boundless network can execute (@backend/API/host/src/pinata.rs#20-60).
2. Spins up an Axum server with `/` and `/validate_user` routes (@backend/API/host/src/main.rs#53-112).
3. Submits proof requests to Boundless, waits for fulfillment, and returns the proof package to callers (@backend/API/host/src/proof_submitter.rs#10-74).

The workspace contains two crates:

```
backend/API
├── host     # Axum server (this README)
└── methods  # RISC Zero guest + build scripts
```

---

## Prerequisites

| Requirement | Reason |
|-------------|--------|
| `rustup` + the toolchain pinned in `rust-toolchain.toml` | Ensures the host and guest compile deterministically. |
| Pinata account + JWT | Required to upload the guest ELF before the server starts (@backend/API/host/src/pinata.rs#20-44). |
| Boundless account credentials | `storage_provider_from_env()` in the Boundless SDK loads provider-specific env vars at runtime (@backend/API/host/src/proof_submitter.rs#16-24). |
| Ethereum RPC endpoint + funded signer | The host signs on-chain requests when submitting to Boundless (@backend/API/host/src/main.rs#24-53). |

Install workspace dependencies once:

```bash
cargo check
```

---

## Required environment

Define the following variables before running `cargo run -p host`.

| Variable | Description |
|----------|-------------|
| `RPC_URL` | HTTPS RPC endpoint for the target network (parsed at boot) (@backend/API/host/src/main.rs#24-53). |
| `PRIVATE_KEY` | Hex-encoded 32-byte ECDSA key used by the Boundless client (@backend/API/host/src/main.rs#24-53). |
| `PINATA_JWT` | JWT from Pinata used to upload `GUEST_CODE_FOR_ZK_PROOF_ELF` and obtain the program CID (@backend/API/host/src/pinata.rs#20-44). |
| Boundless storage vars | Whatever credentials your Boundless storage provider expects; `storage_provider_from_env()` reads them before the client is constructed (@backend/API/host/src/proof_submitter.rs#16-24). |

Example (fish/zsh syntax):

```bash
export RPC_URL="https://sepolia.infura.io/v3/<project>"
export PRIVATE_KEY="<64-hex>"
export PINATA_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# export BOUNDLESS_... (see Boundless docs)
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
RPC_URL=https://rpc.sepolia.mantle.xyz
PRIVATE_KEY=<your-64-char-hex-private-key-WITHOUT-0x-prefix>
PINATA_JWT=<your-pinata-jwt-token>

# Optional: Cache the Pinata CID to avoid rate limits
# After first upload, copy the CID from logs and set:
# PINATA_CID=bafybeid...R5cCI6IkpXVCJ9..."
# export BOUNDLESS_... (see Boundless docs)
```

---

## Running the server

From `backend/API`:

```bash
cargo run -p host
```

What happens:

1. Guest ELF is uploaded to Pinata and the resulting CID is converted into a `guest_program_url` (@backend/API/host/src/main.rs#41-58, @backend/API/host/src/pinata.rs#20-60).
2. Axum listens on `0.0.0.0:3000` with shared state containing the signer, RPC URL, and guest program URL (@backend/API/host/src/main.rs#53-72).
3. Each POST to `/validate_user` invokes `submit_proof_request`, which streams the payload to Boundless, waits for fulfillment, then returns the proof bundle (@backend/API/host/src/main.rs#86-112, @backend/API/host/src/proof_submitter.rs#10-74).

Logs show CID uploads, Boundless request IDs, and fulfillment metadata so you can trace the entire flow.

---

## API reference

| Route | Method | Description |
|-------|--------|-------------|
| `/` | `GET` | Health/info route returning a welcome JSON message (@backend/API/host/src/main.rs#76-117). |
| `/validate_user` | `GET` | Explains the required payload format (@backend/API/host/src/main.rs#119-141). |
| `/validate_user` | `POST` | Accepts a full compliance payload (see schema below), forwards it to Boundless, and responds with `{ outcome, proof, message }` (@backend/API/host/src/main.rs#145-166). |
| `/compliance/pools` | `POST` | Same handler as `/validate_user` for backwards compatibility (used by some integrations). |

You can exercise all routes from `api.http` (VS Code/JetBrains compatible) located next to this README (@backend/API/api.http#1-58) or via the live Swagger UI at `http://localhost:3000/docs` once the server is running.

Sample request:

```bash
curl -X POST http://localhost:3000/validate_user \
  -H "Content-Type: application/json" \
  -d '{
    "user": "0x1111222233334444555566667777888899990000",
    "pool_id": "gold",
    "residency": "US",
    "kyc_level": 2,
    "aml_passed": true,
    "accredited_investor": true,
    "exposure_musd": 20000,
    "requested_amount": 10000,
    "risk_score": 3
  }'
```

The response includes:

- `outcome`: structured compliance decision with the pool, reason, max allocation, and exposure.
- `proof`: journal, seal, and request ID metadata suitable for on-chain submission.
- `message`: human-readable status string.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `PINATA_JWT environment variable must be set` | Missing Pinata JWT export before boot. |
| `private key must be exactly 32 bytes` | `PRIVATE_KEY` not 64 hex chars (@backend/API/host/src/main.rs#24-37). |
| Boundless client fails to build | Required storage provider env vars not present (@backend/API/host/src/proof_submitter.rs#16-24). |
| Request hangs at fulfillment | Boundless job still running; watch the `wait_for_request_fulfillment` log lines to ensure progress (@backend/API/host/src/proof_submitter.rs#39-51). |

---

## Contributing

- Host-specific code lives under `host/src`.
- Guest logic lives under `methods/guest/src`; rebuild by running `cargo run -p host` (build.rs regenerates the guest bindings automatically).
- When you touch the Boundless flow, keep the existing logging — it is relied on by ops dashboards.

For questions about the wider Mantle USD architecture, see the repository root `README.md`.
