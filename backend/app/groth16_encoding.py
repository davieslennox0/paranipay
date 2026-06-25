"""Converts snarkjs's decimal-string Groth16/BN254 artifacts (proof.json,
verification_key.json, public.json) into the big-endian uncompressed byte
encoding Soroban's `crypto().bn254()` host functions expect.

Byte formats (see soroban-sdk crypto::bn254 docs):
  Fr / Fp        : 32 bytes, big-endian
  G1Affine       : be(x) || be(y)                              -> 64 bytes
  G2Affine       : be(x.c1) || be(x.c0) || be(y.c1) || be(y.c0) -> 128 bytes
                   (each Fp2 coordinate is itself c1 || c0, not c0 || c1)

This module has been exercised against the real proof/vk this repo's
circuits/compliance_circom build produced (see backend/tests), but the byte
layout has NOT been round-tripped through an actual compiled Soroban
contract in this environment (no Rust toolchain was available — see the
root README). The G2 c0/c1 ordering in particular is a well-known footgun
across pairing-curve ecosystems (it differs between arkworks-native and
EVM-precompile conventions) — if `pairing_check` fails on testnet, try
swapping c0/c1 here first.
"""
from __future__ import annotations

FIELD_BYTES = 32


def _be(value: int | str, length: int = FIELD_BYTES) -> bytes:
    return int(value).to_bytes(length, "big")


def encode_fr(value: int | str) -> bytes:
    """Encode a single BN254 scalar-field element (Fr)."""
    return _be(value)


def encode_g1(point: list[str]) -> bytes:
    """Encode a G1Affine point given as snarkjs's [x, y, z] (z == "1")."""
    x, y = point[0], point[1]
    return _be(x) + _be(y)


def encode_g2(point: list[list[str]]) -> bytes:
    """Encode a G2Affine point given as snarkjs's [[x_c0,x_c1],[y_c0,y_c1],_]."""
    (x_c0, x_c1), (y_c0, y_c1) = point[0], point[1]
    return _be(x_c1) + _be(x_c0) + _be(y_c1) + _be(y_c0)


def encode_verification_key(vk: dict) -> dict:
    """vk is a parsed snarkjs verification_key.json."""
    return {
        "alpha": encode_g1(vk["vk_alpha_1"]).hex(),
        "beta": encode_g2(vk["vk_beta_2"]).hex(),
        "gamma": encode_g2(vk["vk_gamma_2"]).hex(),
        "delta": encode_g2(vk["vk_delta_2"]).hex(),
        "ic": [encode_g1(p).hex() for p in vk["IC"]],
    }


def encode_proof(proof: dict) -> dict:
    """proof is a parsed snarkjs proof.json."""
    return {
        "a": encode_g1(proof["pi_a"]).hex(),
        "b": encode_g2(proof["pi_b"]).hex(),
        "c": encode_g1(proof["pi_c"]).hex(),
    }


def encode_public_signals(public_signals: list[str]) -> list[str]:
    """public_signals is the parsed snarkjs public.json (decimal strings)."""
    return [encode_fr(s).hex() for s in public_signals]
