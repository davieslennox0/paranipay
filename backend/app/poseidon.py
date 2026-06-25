"""Thin wrapper around circuits/compliance_circom/poseidon_cli.js so the
backend uses the exact same Poseidon implementation (circomlibjs) the
circuit and the trusted setup were built against, instead of re-deriving
round constants in Python.
"""
import json
import subprocess

from . import config


def _run_node(payload: dict) -> dict:
    proc = subprocess.run(
        ["node", str(config.POSEIDON_CLI_PATH)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        timeout=30,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"poseidon_cli failed: {proc.stderr.strip()}")
    return json.loads(proc.stdout)


def poseidon_commitment(kyc_level: int, age: int, jurisdiction_hash: int, salt: int) -> str:
    # Large ints (salt especially) must travel as JSON strings: JSON
    # numbers get parsed into JS float64 by Node, silently losing
    # precision above 2**53. BigInt(<string>) is exact.
    out = _run_node(
        {
            "op": "commitment",
            "kyc_level": str(kyc_level),
            "age": str(age),
            "jurisdiction_hash": str(jurisdiction_hash),
            "salt": str(salt),
        }
    )
    return out["commitment"]


def poseidon_nullifier(user_secret: int, context: int) -> str:
    out = _run_node({"op": "nullifier", "user_secret": str(user_secret), "context": str(context)})
    return out["nullifier"]


def sanctions_merkle_path(sanctioned_bitmap: list[int], jurisdiction_code: int) -> dict:
    """sanctioned_bitmap: 256 entries of 0/1. Returns root + the Merkle
    siblings (and indices, for reference) for jurisdiction_code's leaf."""
    return _run_node(
        {"op": "merkle_path", "leaves": sanctioned_bitmap, "index": jurisdiction_code}
    )
