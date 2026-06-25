# StellarSeal backend

FastAPI service: the KYC oracle (`/attest`), the prover (`/prove`,
`/verify-offchain`), and the Soroban testnet bridge (`/verify/{nullifier}`,
`/tx/verify-compliance`).

Every cryptographic operation here actually runs — there is no mocked
proof or signature path. This was exercised end-to-end while building this
repo (real attestation, real Ed25519 signature, real Groth16 proof, real
`snarkjs groth16 verify` returning `OK`, and real rejections for an
under-age user, a sanctioned jurisdiction, and a too-low KYC tier — see the
root README's "what was actually run" section).

## Setup

```bash
pip install -r requirements.txt
# circuits/compliance_circom must already be built (see its README) —
# /prove shells out to the wasm + zkey it produces.
```

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8420
# or: pm2 start ../ecosystem.config.js --only stellarseal-backend
```

## Endpoints

| Method | Path | What it does |
|---|---|---|
| POST | `/attest` | Oracle signs a Poseidon commitment to a (mock) KYC record with Ed25519 |
| POST | `/prove` | Generates a real Groth16/BN254 proof from an attestation + the user's private inputs |
| POST | `/verify-offchain` | Real `snarkjs groth16 verify` over a proof, no chain needed |
| GET | `/verify/{nullifier_hex}` | Checks nullifier usage on-chain (needs `STELLAR_SEAL_CONTRACT_ID`) |
| POST | `/tx/verify-compliance` | Builds the unsigned `verify_compliance` XDR for Freighter to sign |

## Config (env vars, all optional)

- `STELLAR_SEAL_ORACLE_SEED` — 64 hex char Ed25519 seed; auto-generated into `oracle_key.json` if unset
- `STELLAR_SEAL_REQUIRED_LEVEL` — minimum KYC tier anchors require (default `2`)
- `STELLAR_SEAL_CONTRACT_ID`, `STELLAR_SEAL_RPC_URL`, `STELLAR_SEAL_NETWORK_PASSPHRASE` — set after deploying `contracts/stellar_seal`
- `STELLAR_SEAL_READER_ACCOUNT` — any funded testnet public key, used as the source account for read-only nullifier-check simulations
