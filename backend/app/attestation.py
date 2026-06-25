"""The KYC oracle: signs attestations over a Poseidon commitment of a
user's verified attributes, using real Ed25519 (PyNaCl / libsodium).

Mock KYC data is used (per the project brief, "mock KYC data is fine — the
cryptography must be real") — `MOCK_KYC_DB` stands in for whatever a real
anchor's KYC vendor (Jumio, Sumsub, etc.) would have already verified
out-of-band. Nothing here pretends a passport was actually checked; what's
real is the signature, the hash commitment, and everything downstream.
"""
import json
import secrets
import time
from pathlib import Path

import nacl.encoding
import nacl.exceptions
import nacl.signing

from . import config
from .poseidon import poseidon_commitment, sanctions_merkle_path

ORACLE_KEY_FILE = Path(__file__).resolve().parents[1] / "oracle_key.json"

# Demo KYC vendor records. jurisdiction codes are this repo's compact
# 0-255 registry index (see circuits/compliance_circom), not raw ISO codes.
MOCK_KYC_DB = {
    "maria": {"kyc_level": 3, "age": 29, "jurisdiction_code": 50, "jurisdiction_name": "Philippines (demo registry #50)"},
    "low_tier_lucas": {"kyc_level": 1, "age": 24, "jurisdiction_code": 12, "jurisdiction_name": "Demo registry #12"},
    "minor_mina": {"kyc_level": 3, "age": 16, "jurisdiction_code": 50, "jurisdiction_name": "Demo registry #50"},
    "sanctioned_sam": {"kyc_level": 4, "age": 41, "jurisdiction_code": 77, "jurisdiction_name": "Demo registry #77 (sanctioned)"},
}


def _load_or_create_oracle_key() -> nacl.signing.SigningKey:
    if config.ORACLE_SEED_HEX:
        seed = bytes.fromhex(config.ORACLE_SEED_HEX)
        return nacl.signing.SigningKey(seed)
    if ORACLE_KEY_FILE.exists():
        seed = bytes.fromhex(json.loads(ORACLE_KEY_FILE.read_text())["seed_hex"])
        return nacl.signing.SigningKey(seed)
    signing_key = nacl.signing.SigningKey.generate()
    ORACLE_KEY_FILE.write_text(json.dumps({"seed_hex": bytes(signing_key).hex()}))
    return signing_key


_ORACLE_KEY = _load_or_create_oracle_key()
ORACLE_VERIFY_KEY_HEX = _ORACLE_KEY.verify_key.encode(encoder=nacl.encoding.HexEncoder).decode()


class AttestationError(Exception):
    pass


def issue_attestation(user_id: str) -> dict:
    """The oracle's `/attest`: looks up (mock) KYC facts for `user_id`,
    commits to them with a fresh blinding salt, and signs the commitment
    with the oracle's real Ed25519 key."""
    record = MOCK_KYC_DB.get(user_id)
    if record is None:
        raise AttestationError(f"no KYC record for user_id={user_id!r}")

    salt = secrets.randbelow(2**200)
    commitment = poseidon_commitment(
        record["kyc_level"], record["age"], record["jurisdiction_code"], salt
    )
    issued_at = int(time.time())
    expires_at = issued_at + config.ATTESTATION_TTL_SECONDS

    signing_payload = f"{commitment}:{expires_at}".encode()
    signature = _ORACLE_KEY.sign(signing_payload).signature

    sanctioned_bitmap = [1 if i in config.SANCTIONED_JURISDICTIONS else 0 for i in range(256)]
    merkle = sanctions_merkle_path(sanctioned_bitmap, record["jurisdiction_code"])

    return {
        "user_id": user_id,
        "kyc_level": record["kyc_level"],
        "age": record["age"],
        "jurisdiction_code": record["jurisdiction_code"],
        "jurisdiction_name": record["jurisdiction_name"],
        "salt": str(salt),
        "commitment": commitment,
        "issued_at": issued_at,
        "expires_at": expires_at,
        "oracle_pubkey": ORACLE_VERIFY_KEY_HEX,
        "signature": signature.hex(),
        "sanctions_merkle_root": merkle["root"],
        "sanctions_path_elements": merkle["path_elements"],
    }


def verify_attestation(att: dict) -> None:
    """Independently re-verifies the oracle's signature — anyone holding
    the oracle's public key can run this, not just this same process.
    Raises AttestationError if invalid or expired."""
    if int(time.time()) > att["expires_at"]:
        raise AttestationError("attestation expired")

    expected_commitment = poseidon_commitment(
        att["kyc_level"], att["age"], att["jurisdiction_code"], int(att["salt"])
    )
    if expected_commitment != att["commitment"]:
        raise AttestationError("commitment does not match attested attributes")

    verify_key = nacl.signing.VerifyKey(att["oracle_pubkey"], encoder=nacl.encoding.HexEncoder)
    signing_payload = f"{att['commitment']}:{att['expires_at']}".encode()
    try:
        verify_key.verify(signing_payload, bytes.fromhex(att["signature"]))
    except nacl.exceptions.BadSignatureError as e:
        raise AttestationError("invalid oracle signature") from e
