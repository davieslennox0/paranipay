const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8420";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface Attestation {
  user_id: string;
  kyc_level: number;
  age: number;
  jurisdiction_code: number;
  jurisdiction_name: string;
  salt: string;
  commitment: string;
  issued_at: number;
  expires_at: number;
  oracle_pubkey: string;
  signature: string;
  sanctions_merkle_root: string;
  sanctions_path_elements: string[];
}

export interface ProveResponse {
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[]; protocol: string; curve: string };
  public_signals: string[];
  nullifier: string;
  context_field: string;
  verified_offchain: boolean;
  user_secret: string;
  encoded: {
    proof: { a: string; b: string; c: string };
    public_signals: string[];
  };
}

export function attest(userId: string): Promise<Attestation> {
  return request("/attest", { method: "POST", body: JSON.stringify({ user_id: userId }) });
}

export function prove(attestation: Attestation, context: string, userSecret?: string): Promise<ProveResponse> {
  return request("/prove", {
    method: "POST",
    body: JSON.stringify({ attestation, context, user_secret: userSecret }),
  });
}

export function verifyOffchain(proof: ProveResponse["proof"], publicSignals: string[]): Promise<{ verified: boolean }> {
  return request("/verify-offchain", {
    method: "POST",
    body: JSON.stringify({ proof, public_signals: publicSignals }),
  });
}

export function checkNullifier(nullifierHex: string): Promise<{ nullifier: string; used: boolean }> {
  return request(`/verify/${nullifierHex}`);
}

export function buildVerifyTx(
  anchorAddress: string,
  anchorId: string,
  encodedProof: ProveResponse["encoded"]["proof"],
  encodedPublicSignals: string[]
): Promise<{ xdr: string }> {
  return request("/tx/verify-compliance", {
    method: "POST",
    body: JSON.stringify({
      anchor_address: anchorAddress,
      anchor_id: anchorId,
      encoded_proof: encodedProof,
      encoded_public_signals: encodedPublicSignals,
    }),
  });
}
