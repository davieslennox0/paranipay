"""Real Groth16/BN254 proof generation: builds the circuit witness and
shells out to `snarkjs groth16 prove`. Nothing here is mocked — this is
the same circuit, wasm and zkey produced by circuits/compliance_circom's
build (see that directory's README for how they were generated).
"""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from . import config
from .groth16_encoding import encode_proof, encode_public_signals
from .poseidon import poseidon_nullifier

BN254_R = 21888242871839275222246405745257275088548364400416034343698204186575808495617


class ProverError(Exception):
    pass


def context_to_field(context: str) -> int:
    digest = hashlib.sha256(context.encode()).digest()
    return int.from_bytes(digest, "big") % BN254_R


def generate_proof(
    kyc_level: int,
    age: int,
    jurisdiction_code: int,
    salt: int,
    user_secret: int,
    sanctions_path_elements: list[str],
    sanctions_merkle_root: str,
    attestation_commitment: str,
    context: str,
) -> dict:
    if not config.ZKEY_PATH.exists():
        raise ProverError(
            "circuit build artifacts not found — run the steps in "
            "circuits/compliance_circom/README.md first"
        )

    context_field = context_to_field(context)
    expected_nullifier = poseidon_nullifier(user_secret, context_field)

    circuit_input = {
        "kyc_level": str(kyc_level),
        "age": str(age),
        "jurisdiction_hash": str(jurisdiction_code),
        "salt": str(salt),
        "user_secret": str(user_secret),
        "sanctions_path_elements": [str(e) for e in sanctions_path_elements],
        "required_level": str(config.REQUIRED_KYC_LEVEL),
        "sanctions_merkle_root": str(sanctions_merkle_root),
        "attestation_commitment": str(attestation_commitment),
        "context": str(context_field),
    }

    with tempfile.TemporaryDirectory(prefix="stellarseal_") as tmp:
        tmp_path = Path(tmp)
        input_path = tmp_path / "input.json"
        witness_path = tmp_path / "witness.wtns"
        proof_path = tmp_path / "proof.json"
        public_path = tmp_path / "public.json"

        input_path.write_text(json.dumps(circuit_input))

        _run(
            [
                "node",
                str(config.WITNESS_CALC_PATH),
                str(config.WASM_PATH),
                str(input_path),
                str(witness_path),
            ],
            "witness generation failed — the private inputs likely fail "
            "the compliance predicate (kyc_level/age/sanctions check)",
        )

        _run(
            [
                "snarkjs",
                "groth16",
                "prove",
                str(config.ZKEY_PATH),
                str(witness_path),
                str(proof_path),
                str(public_path),
            ],
            "groth16 proving failed",
        )

        proof_json = json.loads(proof_path.read_text())
        public_json = json.loads(public_path.read_text())

        verify_proc = _run(
            [
                "snarkjs",
                "groth16",
                "verify",
                str(config.VERIFICATION_KEY_PATH),
                str(public_path),
                str(proof_path),
            ],
            "the proof we just generated failed its own off-chain verification",
        )
        verified_offchain = "OK" in verify_proc.stdout

    nullifier = public_json[0]
    if nullifier != expected_nullifier:
        raise ProverError("circuit nullifier did not match expected value — internal error")

    return {
        "proof": proof_json,
        "public_signals": public_json,
        "nullifier": nullifier,
        "context_field": str(context_field),
        "verified_offchain": verified_offchain,
        "encoded": {
            "proof": encode_proof(proof_json),
            "public_signals": encode_public_signals(public_json),
        },
    }


def verify_proof_offchain(proof: dict, public_signals: list[str]) -> bool:
    """Real off-chain verification via `snarkjs groth16 verify` — used by
    GET /verify and as a sanity check before ever submitting to chain."""
    with tempfile.TemporaryDirectory(prefix="stellarseal_verify_") as tmp:
        tmp_path = Path(tmp)
        proof_path = tmp_path / "proof.json"
        public_path = tmp_path / "public.json"
        proof_path.write_text(json.dumps(proof))
        public_path.write_text(json.dumps(public_signals))

        proc = subprocess.run(
            [
                "snarkjs",
                "groth16",
                "verify",
                str(config.VERIFICATION_KEY_PATH),
                str(public_path),
                str(proof_path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return proc.returncode == 0 and "OK" in proc.stdout


def _run(cmd: list[str], error_prefix: str, check: bool = True):
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if check and proc.returncode != 0:
        raise ProverError(f"{error_prefix}: {proc.stderr.strip() or proc.stdout.strip()}")
    return proc
