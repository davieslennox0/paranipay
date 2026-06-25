export type Stage = "idle" | "circuit" | "proof" | "onchain" | "cleared";

const STEPS: { key: Stage; label: string }[] = [
  { key: "circuit", label: "Circuit + attestation" },
  { key: "proof",   label: "Proof generated" },
  { key: "onchain", label: "Submitted on-chain" },
  { key: "cleared", label: "Compliance cleared" },
];

const ORDER: Stage[] = ["idle", "circuit", "proof", "onchain", "cleared"];

export function ProofTimeline({ stage }: { stage: Stage }) {
  const currentIndex = ORDER.indexOf(stage);

  return (
    <div className="timeline">
      {STEPS.map((step, i) => {
        const stepIndex = ORDER.indexOf(step.key);
        const done   = currentIndex > stepIndex;
        const active = currentIndex === stepIndex;
        return (
          <div key={step.key} className={`timeline-step${done ? " done" : ""}${active ? " active" : ""}`}>
            {i > 0 && <div className="timeline-line" />}
            <div className="timeline-dot" />
            <div className="timeline-label">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}
