import { useState } from "react";
import { ApiError, Attestation, ProveResponse, attest, prove } from "../api";
import { HashBox, truncate } from "./HashBox";
import { Stage } from "./ProofTimeline";

const DEMO_USERS = [
  { id: "maria",          label: "Maria — KYC tier 3, age 29, PH (passes)" },
  { id: "low_tier_lucas", label: "Lucas — KYC tier 1 (below required tier)" },
  { id: "minor_mina",     label: "Mina — age 16 (fails age check)" },
  { id: "sanctioned_sam", label: "Sam — sanctioned jurisdiction" },
];

const PROVING_PHASES = [
  "Building circuit witness…",
  "Generating Groth16/BN254 proof…",
  "Checking proof off-chain…",
];

export function UserPanel({
  onStageChange,
  onSendToAnchor,
}: {
  onStageChange: (s: Stage) => void;
  onSendToAnchor: (data: { proveResult: ProveResponse; context: string }) => void;
}) {
  const [userId, setUserId]       = useState(DEMO_USERS[0].id);
  const [context, setContext]     = useState("anchor:ph-remit-001:payment:200usd");
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [proveResult, setProveResult] = useState<ProveResponse | null>(null);
  const [phase, setPhase]         = useState(0);
  const [busy, setBusy]           = useState<"attest" | "prove" | null>(null);
  const [error, setError]         = useState<string | null>(null);

  async function handleAttest() {
    setError(null);
    setAttestation(null);
    setProveResult(null);
    setBusy("attest");
    onStageChange("circuit");
    try {
      const att = await attest(userId);
      setAttestation(att);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      onStageChange("idle");
    } finally {
      setBusy(null);
    }
  }

  async function handleProve() {
    if (!attestation) return;
    setError(null);
    setProveResult(null);
    setBusy("prove");
    let i = 0;
    const interval = setInterval(() => { i = (i + 1) % PROVING_PHASES.length; setPhase(i); }, 1400);
    try {
      const result = await prove(attestation, context);
      setProveResult(result);
      onStageChange("proof");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      clearInterval(interval);
      setPhase(0);
      setBusy(null);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title user">User — generate proof</div>

      <div className="field">
        <label>Demo identity</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} disabled={busy !== null}>
          {DEMO_USERS.map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Payment context</label>
        <input value={context} onChange={(e) => setContext(e.target.value)} disabled={busy !== null} />
      </div>

      <button onClick={handleAttest} disabled={busy !== null}>
        {busy === "attest" ? <span className="spinner" /> : "1. Request KYC attestation"}
      </button>

      {attestation && (
        <>
          <div className="divider" />
          <div className="muted" style={{ marginBottom: 8 }}>
            Oracle signed (Ed25519) a commitment to {attestation.jurisdiction_name}, tier{" "}
            {attestation.kyc_level}, age {attestation.age} — without revealing any of that to the anchor.
          </div>
          <HashBox>
            commitment: <span className="accent">{truncate(attestation.commitment)}</span>
            <br />
            signature: {truncate(attestation.signature, 12, 10)}
            <br />
            oracle pubkey: {truncate(attestation.oracle_pubkey, 12, 6)}
          </HashBox>

          <div style={{ marginTop: 12 }}>
            <button className="primary" onClick={handleProve} disabled={busy !== null}>
              {busy === "prove" ? (
                <><span className="spinner" /> {PROVING_PHASES[phase]}</>
              ) : (
                "2. Generate ZK proof"
              )}
            </button>
          </div>
        </>
      )}

      {proveResult && (
        <>
          <div className="divider" />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className={`badge ${proveResult.verified_offchain ? "ok" : "err"}`}>
              {proveResult.verified_offchain ? "snarkjs: proof OK" : "verification failed"}
            </span>
            <span className="muted">Groth16 / BN254 · {proveResult.proof.curve}</span>
          </div>
          <HashBox>
            nullifier: <span className="accent">{truncate(proveResult.nullifier)}</span>
            <br />
            proof.a: {truncate(proveResult.encoded.proof.a, 14, 8)}
            <br />
            proof.b: {truncate(proveResult.encoded.proof.b, 14, 8)}
            <br />
            proof.c: {truncate(proveResult.encoded.proof.c, 14, 8)}
            <br />
            public signals: [{proveResult.public_signals.map((s) => truncate(s, 6, 4)).join(", ")}]
          </HashBox>
          <div style={{ marginTop: 12 }}>
            <button className="success" onClick={() => onSendToAnchor({ proveResult, context })}>
              3. Send proof to anchor →
            </button>
          </div>
        </>
      )}

      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
