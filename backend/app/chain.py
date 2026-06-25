"""Soroban testnet integration: checking nullifier status and building the
unsigned `verify_compliance` transaction for the anchor to sign with
Freighter.

Two things here are unverified against a real deployed contract (this
sandbox has no Rust toolchain to build+deploy contracts/stellar_seal — see
its README): the exact ScVal encoding of the `Proof`/`VerificationKey`
structs (built here as `scval.from_struct` maps keyed by field name,
matching how soroban-sdk's `#[contracttype]` derives struct encoding), and
the G2 Fp2 c0/c1 limb order inherited from groth16_encoding.py. Both are
implemented to match documented/observed conventions, not guessed
blindly, but flag them if testnet calls fail validation.
"""
from __future__ import annotations

from stellar_sdk import Network, SorobanServer, TransactionBuilder, scval
from stellar_sdk.exceptions import NotFoundError

from . import config


class ChainNotConfigured(Exception):
    pass


def _require_contract_id() -> str:
    if not config.CONTRACT_ID:
        raise ChainNotConfigured(
            "STELLAR_SEAL_CONTRACT_ID is not set — deploy contracts/stellar_seal "
            "(see its README) and set the env var before calling chain endpoints"
        )
    return config.CONTRACT_ID


def get_server() -> SorobanServer:
    return SorobanServer(config.SOROBAN_RPC_URL)


def _g1_scval(hex_bytes: str):
    return scval.from_bytes(bytes.fromhex(hex_bytes))


def _g2_scval(hex_bytes: str):
    return scval.from_bytes(bytes.fromhex(hex_bytes))


def _fr_scval(hex_bytes: str):
    return scval.from_bytes(bytes.fromhex(hex_bytes))


def check_nullifier_used(nullifier_hex: str) -> bool:
    contract_id = _require_contract_id()
    server = get_server()
    reader = _reader_account_id()

    source_account = server.load_account(reader)
    tx = (
        TransactionBuilder(source_account, config.NETWORK_PASSPHRASE, base_fee=100)
        .append_invoke_contract_function_op(
            contract_id=contract_id,
            function_name="is_nullifier_used",
            parameters=[scval.from_bytes(bytes.fromhex(nullifier_hex))],
        )
        .set_timeout(30)
        .build()
    )
    sim = server.simulate_transaction(tx)
    if sim.error:
        raise RuntimeError(f"simulation failed: {sim.error}")
    return bool(scval.to_native(sim.results[0].xdr))


def build_verify_compliance_xdr(
    anchor_address: str,
    anchor_id_symbol: str,
    encoded_proof: dict,
    encoded_public_signals: list[str],
    encoded_vk: dict,
) -> str:
    """Returns an unsigned transaction envelope (base64 XDR) invoking
    `verify_compliance`. The frontend has Freighter sign this — the
    backend never holds the anchor's keys."""
    contract_id = _require_contract_id()
    server = get_server()
    source_account = server.load_account(anchor_address)

    proof_struct = scval.from_struct(
        {
            "a": _g1_scval(encoded_proof["a"]),
            "b": _g2_scval(encoded_proof["b"]),
            "c": _g1_scval(encoded_proof["c"]),
        }
    )
    public_signals_vec = scval.from_vec([_fr_scval(s) for s in encoded_public_signals])

    tx = (
        TransactionBuilder(source_account, config.NETWORK_PASSPHRASE, base_fee=100)
        .append_invoke_contract_function_op(
            contract_id=contract_id,
            function_name="verify_compliance",
            parameters=[
                scval.from_symbol(anchor_id_symbol),
                proof_struct,
                public_signals_vec,
            ],
        )
        .set_timeout(60)
        .build()
    )
    prepared = server.prepare_transaction(tx)
    return prepared.to_xdr()


def _reader_account_id() -> str:
    import os

    account = os.environ.get("STELLAR_SEAL_READER_ACCOUNT")
    if not account:
        raise ChainNotConfigured(
            "STELLAR_SEAL_READER_ACCOUNT not set — fund any testnet account "
            "(friendbot) and set its public key so read-only simulation calls "
            "have a source account"
        )
    return account
