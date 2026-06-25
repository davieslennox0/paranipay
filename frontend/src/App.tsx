import { useState } from "react";
import { ProveResponse } from "./api";
import { AnchorPanel } from "./components/AnchorPanel";
import { ProofTimeline, Stage } from "./components/ProofTimeline";
import { Char, CharSim } from "./components/SimulationPage";
import { UserPanel } from "./components/UserPanel";

export default function App() {
  const [stage, setStage]       = useState<Stage>("idle");
  const [incoming, setIncoming] = useState<{ proveResult: ProveResponse; context: string } | null>(null);
  const [simChar, setSimChar]   = useState<Char>("mary");
  const [simKey, setSimKey]     = useState(0);

  function switchSim(c: Char) {
    setSimChar(c);
    setSimKey((k) => k + 1);
  }

  return (
    <div>
      {/* ══ Header ══ */}
      <header className="site-header">
        <div className="container">
          <div className="brand">
            <div className="brand-mark" />
            <span className="brand-name">ParaniPay</span>
          </div>
          <div className="header-right">
            <span className="proto-badge">Protocol 26</span>
            <span className="muted">Groth16 · BN254 · Stellar testnet</span>
          </div>
        </div>
      </header>

      {/* ══ Hero ══ */}
      <section className="hero">
        <div className="container hero-grid">

          {/* Left: copy */}
          <div>
            <div className="hero-eyebrow">Zero-Knowledge KYC for Stellar Anchors</div>
            <h1 className="headline">
              Prove you comply.<br />
              <em>Reveal nothing.</em>
            </h1>
            <p className="hero-sub">
              Maria sends $200 to the Philippines through a Stellar anchor.
              Instead of uploading her passport, she generates a ZK proof.
              The anchor verifies it on Stellar and learns nothing about who she is.
            </p>
            <a href="#demo" className="cta-btn">Try the live demo ↓</a>
            <div className="hero-stats">
              <span className="stat-pill">Real Groth16/BN254 proofs</span>
              <span className="stat-pill">Protocol 26 host functions</span>
              <span className="stat-pill">Zero identity to anchor</span>
            </div>
          </div>

          {/* Right: simulation — same panel design as the demo, no phone frame */}
          <div className="hero-panel">
            <div className="hero-panel-header">
              <div className="hero-panel-label">
                <span className="live-dot" />
                Live demo
              </div>
              <div className="char-tabs">
                <button
                  className={simChar === "mary" ? "char-tab active" : "char-tab"}
                  onClick={() => switchSim("mary")}
                >
                  👩 Maria — passes
                </button>
                <button
                  className={simChar === "lucas" ? "char-tab active" : "char-tab"}
                  onClick={() => switchSim("lucas")}
                >
                  👨 Lucas — fails
                </button>
              </div>
            </div>
            <div className="hero-panel-body">
              <CharSim
                key={simKey}
                char={simChar}
                onReplay={() => setSimKey((k) => k + 1)}
              />
            </div>
          </div>

        </div>
      </section>

      {/* ══ How it works ══ */}
      <section className="how-section">
        <div className="container">
          <div className="section-label">How it works</div>
          <h2 className="section-title">Zero-knowledge compliance in three steps</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">1</div>
              <div className="step-title">KYC Attestation</div>
              <div className="step-body">
                The oracle signs a Poseidon commitment over your verified KYC attributes —
                jurisdiction, tier, age — with Ed25519. No raw data leaves the oracle.
              </div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-num">2</div>
              <div className="step-title">ZK Proof</div>
              <div className="step-body">
                A Groth16/BN254 circuit proves the compliance predicate without revealing
                any underlying attribute. A nullifier prevents replay attacks.
              </div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-num">3</div>
              <div className="step-title">On-chain Verify</div>
              <div className="step-body">
                The anchor submits the proof to a Soroban contract. Protocol 26 host
                functions check the pairing math natively — fast and cheap.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Interactive Demo ══ */}
      <section className="demo-section" id="demo">
        <div className="container">
          <div className="section-label">Interactive demo</div>
          <h2 className="section-title">Try it yourself</h2>
          <ProofTimeline stage={stage} />
          <div className="panels">
            <UserPanel onStageChange={setStage} onSendToAnchor={setIncoming} />
            <AnchorPanel incoming={incoming} onStageChange={setStage} />
          </div>
        </div>
      </section>

      {/* ══ Footer ══ */}
      <footer className="site-footer">
        <div className="container">
          <span className="muted">
            ParaniPay · Real Groth16/BN254 proofs · Protocol 26 · MIT License
          </span>
        </div>
      </footer>
    </div>
  );
}
