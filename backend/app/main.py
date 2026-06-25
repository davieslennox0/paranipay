import secrets

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import attestation, chain, config, prover

app = FastAPI(title="ParaniPay", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "name": "ParaniPay",
        "oracle_pubkey": attestation.ORACLE_VERIFY_KEY_HEX,
        "required_kyc_level": config.REQUIRED_KYC_LEVEL,
        "contract_id": config.CONTRACT_ID,
    }


class AttestRequest(BaseModel):
    user_id: str


@app.post("/attest")
def attest(req: AttestRequest):
    """The KYC oracle. Signs (Ed25519) a commitment to the user's verified
    attributes — the anchor and the contract only ever see the commitment
    and signature, never the attributes themselves."""
    try:
        return attestation.issue_attestation(req.user_id)
    except attestation.AttestationError as e:
        raise HTTPException(status_code=404, detail=str(e))


class ProveRequest(BaseModel):
    attestation: dict
    user_secret: str | None = None
    context: str


@app.post("/prove")
def prove(req: ProveRequest):
    """Generates a real Groth16/BN254 proof (circom + snarkjs, no
    mocking) that the attested attributes satisfy the compliance
    predicate, bound to `context` (e.g. "anchor:<id>:payment:<id>") via the
    nullifier."""
    try:
        attestation.verify_attestation(req.attestation)
    except attestation.AttestationError as e:
        raise HTTPException(status_code=400, detail=f"invalid attestation: {e}")

    user_secret = int(req.user_secret) if req.user_secret else secrets.randbelow(2**200)

    try:
        result = prover.generate_proof(
            kyc_level=req.attestation["kyc_level"],
            age=req.attestation["age"],
            jurisdiction_code=req.attestation["jurisdiction_code"],
            salt=int(req.attestation["salt"]),
            user_secret=user_secret,
            sanctions_path_elements=req.attestation["sanctions_path_elements"],
            sanctions_merkle_root=req.attestation["sanctions_merkle_root"],
            attestation_commitment=req.attestation["commitment"],
            context=req.context,
        )
    except prover.ProverError as e:
        raise HTTPException(status_code=422, detail=str(e))

    result["user_secret"] = str(user_secret)
    return result


@app.get("/verify/{nullifier_hex}")
def verify(nullifier_hex: str):
    """Checks whether `nullifier_hex` has already been used on-chain
    (replay check). Requires contracts/stellar_seal to be deployed and
    STELLAR_SEAL_CONTRACT_ID set."""
    try:
        used = chain.check_nullifier_used(nullifier_hex)
    except chain.ChainNotConfigured as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"chain query failed: {e}")
    return {"nullifier": nullifier_hex, "used": used}


class VerifyOffchainRequest(BaseModel):
    proof: dict
    public_signals: list[str]


@app.post("/verify-offchain")
def verify_offchain(req: VerifyOffchainRequest):
    """Real `snarkjs groth16 verify` over the given proof — lets the UI
    show that the proof checks out before ever touching the chain."""
    ok = prover.verify_proof_offchain(req.proof, req.public_signals)
    return {"verified": ok}


class BuildVerifyTxRequest(BaseModel):
    anchor_address: str
    anchor_id: str
    encoded_proof: dict
    encoded_public_signals: list[str]
    encoded_vk: dict | None = None


@app.post("/tx/verify-compliance")
def build_verify_tx(req: BuildVerifyTxRequest):
    """Builds the unsigned `verify_compliance` transaction XDR for the
    anchor to sign with Freighter and submit themselves — the backend
    never holds or uses the anchor's signing key."""
    try:
        xdr = chain.build_verify_compliance_xdr(
            anchor_address=req.anchor_address,
            anchor_id_symbol=req.anchor_id,
            encoded_proof=req.encoded_proof,
            encoded_public_signals=req.encoded_public_signals,
            encoded_vk=req.encoded_vk or {},
        )
    except chain.ChainNotConfigured as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"failed to build transaction: {e}")
    return {"xdr": xdr}
