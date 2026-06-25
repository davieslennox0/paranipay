import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CIRCUIT_DIR = REPO_ROOT / "circuits" / "compliance_circom"
BUILD_DIR = CIRCUIT_DIR / "build"

WASM_PATH = BUILD_DIR / "compliance_js" / "compliance.wasm"
WITNESS_CALC_PATH = BUILD_DIR / "compliance_js" / "generate_witness.js"
ZKEY_PATH = BUILD_DIR / "compliance_final.zkey"
VERIFICATION_KEY_PATH = BUILD_DIR / "verification_key.json"
POSEIDON_CLI_PATH = CIRCUIT_DIR / "poseidon_cli.js"

REQUIRED_KYC_LEVEL = int(os.environ.get("STELLAR_SEAL_REQUIRED_LEVEL", "2"))
SANCTIONS_DEPTH = 8

# Demo sanctions registry: jurisdiction registry codes (0-255) considered
# sanctioned. In production this would be maintained by the anchor's
# compliance team and the root published/rotated on-chain via
# set_sanctions_root.
SANCTIONED_JURISDICTIONS = {13, 77, 201}

ORACLE_SEED_HEX = os.environ.get("STELLAR_SEAL_ORACLE_SEED")  # 64 hex chars, optional
ATTESTATION_TTL_SECONDS = int(os.environ.get("STELLAR_SEAL_ATTESTATION_TTL", "600"))

SOROBAN_RPC_URL = os.environ.get("STELLAR_SEAL_RPC_URL", "https://soroban-testnet.stellar.org")
NETWORK_PASSPHRASE = os.environ.get(
    "STELLAR_SEAL_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015"
)
CONTRACT_ID = os.environ.get("STELLAR_SEAL_CONTRACT_ID")  # set after deploying contracts/stellar_seal
