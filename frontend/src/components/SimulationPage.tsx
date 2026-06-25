import { useCallback, useEffect, useRef, useState } from "react";

export type Char = "mary" | "lucas";

type StepId =
  | "idle" | "attesting" | "attested"
  | "proving_1" | "proving_2" | "proving_3"
  | "proved" | "sending" | "verifying" | "cleared" | "failed";

interface ScriptStep { id: StepId; delay: number }

const MARY_SCRIPT: ScriptStep[] = [
  { id: "attesting", delay: 900  },
  { id: "attested",  delay: 2100 },
  { id: "proving_1", delay: 1800 },
  { id: "proving_2", delay: 1600 },
  { id: "proving_3", delay: 1400 },
  { id: "proved",    delay: 1100 },
  { id: "sending",   delay: 2000 },
  { id: "verifying", delay: 900  },
  { id: "cleared",   delay: 2400 },
];

const LUCAS_SCRIPT: ScriptStep[] = [
  { id: "attesting", delay: 900  },
  { id: "attested",  delay: 2100 },
  { id: "proving_1", delay: 1800 },
  { id: "failed",    delay: 1700 },
];

const MARY = {
  commitment: "0x7b3f9a2e4c8d1f6b0e5a3c7d9f2b4e8a1d3c7f9b2e4a6c8d",
  signature:  "0x4e8a2f6b1c9d3e7f0a5b8c2d4e6f8a0b1c2d3e4f",
  pubkey:     "0xabc1234def5678900abcdef123456789012",
  nullifier:  "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
  proofA:     "0xf1e2d3c4b5a697f08e1d2c3b4a596",
  proofB:     "0x8a7b6c5d4e3f2a1b9c8d7e6f5a4b",
  proofC:     "0x9c8b7a6f5e4d3c2b1a0908f7e6d5",
};

const LUCAS = {
  commitment: "0x3c7d9f2b4e8a1d6f0b5a3e7c9d2f4b8a1e3c7f9b2d4a6e8c",
  signature:  "0x1c9d3e7f0a5b8c2d4e6f8a0b4e8a2f6b1c2d3e4f",
  pubkey:     "0xdef4567abc1230fedcba0987654321fedcba09",
};

function trunc(s: string, head = 12, tail = 8): string {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function numCls(active: boolean, done: boolean) {
  return `sim-step-num${done ? " done" : active ? " active" : ""}`;
}

export function CharSim({ char, onReplay }: { char: Char; onReplay: () => void }) {
  const [stepId, setStepId] = useState<StepId>("idle");
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const script = char === "mary" ? MARY_SCRIPT : LUCAS_SCRIPT;
  const data   = char === "mary" ? MARY : LUCAS;
  const info   = char === "mary"
    ? { name: "Maria", age: 29, place: "Philippines", tier: 3 }
    : { name: "Lucas", age: 34, place: "United States",  tier: 1 };

  const startPlay = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing) return;
    setStepId("idle");
    let cancelled = false;

    const advance = (i: number) => {
      if (i >= script.length || cancelled) { if (!cancelled) setPlaying(false); return; }
      const { id, delay } = script[i];
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        setStepId(id);
        if (i + 1 < script.length) advance(i + 1); else setPlaying(false);
      }, delay);
    };

    advance(0);
    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, script]);

  useEffect(() => {
    const t = setTimeout(startPlay, 600);
    return () => clearTimeout(t);
  }, [startPlay]);

  const s1done   = (["attested","proving_1","proving_2","proving_3","proved","sending","verifying","cleared","failed"] as StepId[]).includes(stepId);
  const s1active = stepId === "attesting";
  const s2done   = (["proved","sending","verifying","cleared"] as StepId[]).includes(stepId);
  const s2active = (["proving_1","proving_2","proving_3"] as StepId[]).includes(stepId);
  const s3done   = stepId === "cleared";
  const s3active = stepId === "sending" || stepId === "verifying";
  const showData = s1done;
  const showProve = s1done;
  const showProveData = s2done;
  const showSend = char === "mary" && (s2done || s3active || s3done);
  const failed   = stepId === "failed";
  const done     = stepId === "cleared" || stepId === "failed";

  function proveLbl() {
    if (stepId === "proving_1") return <><span className="spinner" /> Building circuit witness…</>;
    if (stepId === "proving_2") return <><span className="spinner" /> Generating Groth16/BN254 proof…</>;
    if (stepId === "proving_3") return <><span className="spinner" /> Checking proof off-chain…</>;
    if (s2done) return "Proof generated ✓";
    return "2. Generate ZK proof";
  }

  function sendLbl() {
    if (stepId === "sending")   return <><span className="spinner" /> Sending to anchor…</>;
    if (stepId === "verifying") return <><span className="spinner" /> Verifying on Stellar…</>;
    if (s3done) return "Verified on Stellar ✓";
    return "3. Send proof to anchor →";
  }

  return (
    <div className="sim-content">
      {/* Identity */}
      <div className="sim-identity">
        <span className="sim-avatar">{char === "mary" ? "👩" : "👨"}</span>
        <div className="sim-id-info">
          <div className="sim-name">{info.name}</div>
          <div className="sim-meta">Age {info.age} · {info.place} · KYC Tier {info.tier}</div>
        </div>
        <span className={`badge ${char === "mary" ? "ok" : "err"}`}>
          {char === "mary" ? "Passes" : "Fails"}
        </span>
      </div>

      <div className="sim-context">
        <span style={{ color: "var(--muted)" }}>Context: </span>
        <code>anchor:ph-remit-001:payment:200usd</code>
      </div>

      <div className="divider" style={{ margin: "8px 0" }} />

      {/* Step 1 */}
      <div className="sim-section">
        <div className="sim-step-label">
          <span className={numCls(s1active, s1done)}>1</span>
          KYC Attestation
        </div>
        <button
          className={s1done ? "success" : s1active ? "primary" : ""}
          disabled style={{ width: "100%", marginTop: 8 }}
        >
          {s1active
            ? <><span className="spinner" /> Requesting attestation…</>
            : s1done ? "Attestation received ✓"
            : "1. Request KYC attestation"}
        </button>
        {showData && (
          <div className="hash-box" style={{ marginTop: 10 }}>
            commitment: <span className="accent">{trunc(data.commitment, 14, 8)}</span><br />
            signature: {trunc(data.signature, 12, 8)}<br />
            oracle pubkey: {trunc(data.pubkey, 12, 6)}
          </div>
        )}
      </div>

      {/* Step 2 */}
      {showProve && (
        <div className="sim-section">
          <div className="sim-step-label">
            <span className={numCls(s2active, s2done)}>2</span>
            ZK Proof
          </div>

          {!failed ? (
            <>
              <button
                className={s2done ? "success" : (s2active || stepId === "attested") ? "primary" : ""}
                disabled style={{ width: "100%", marginTop: 8 }}
              >
                {proveLbl()}
              </button>
              {showProveData && (
                <div className="hash-box" style={{ marginTop: 10 }}>
                  nullifier: <span className="accent">{trunc(MARY.nullifier, 14, 8)}</span><br />
                  proof.a: {trunc(MARY.proofA, 12, 6)}<br />
                  proof.b: {trunc(MARY.proofB, 12, 6)}<br />
                  proof.c: {trunc(MARY.proofC, 12, 6)}<br />
                  <span style={{ color: "var(--blue)", fontSize: 11 }}>Groth16 · BN254 · verified ✓</span>
                </div>
              )}
            </>
          ) : (
            <>
              <button className="primary" disabled style={{ width: "100%", marginTop: 8 }}>
                Building circuit witness…
              </button>
              <div className="sim-error-card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span className="badge err">Proof Failed</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--red)", marginBottom: 4 }}>
                  KYC level insufficient
                </div>
                <div className="muted">Required: Tier 2 · Got: Tier {info.tier}</div>
                <div className="muted" style={{ marginTop: 6, lineHeight: 1.55 }}>
                  The circuit rejected the witness — Lucas's KYC tier does not satisfy the compliance constraint. No proof generated; no identity data exposed.
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3 — Mary only */}
      {showSend && (
        <div className="sim-section">
          <div className="sim-step-label">
            <span className={numCls(s3active, s3done)}>3</span>
            Anchor Verification
          </div>
          <button
            className={s3done ? "success" : "primary"}
            disabled style={{ width: "100%", marginTop: 8 }}
          >
            {sendLbl()}
          </button>
          {s3done && (
            <div className="payment-card unlocked" style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge ok">ComplianceCleared</span>
                <span className="muted" style={{ fontSize: 11 }}>verified off-chain</span>
              </div>
              <div className="divider" />
              <div className="payment-row"><span>Payment</span><span>$200.00 → Philippines</span></div>
              <div className="payment-row">
                <span>Compliance</span>
                <span style={{ color: "var(--green)" }}>Passed (zero-knowledge)</span>
              </div>
              <div className="payment-row">
                <span>Identity shared</span>
                <span style={{ color: "var(--green)" }}>None</span>
              </div>
            </div>
          )}
        </div>
      )}

      {done && !playing && (
        <button onClick={onReplay} style={{ marginTop: 12, width: "100%" }}>
          ↺ Replay
        </button>
      )}
    </div>
  );
}
