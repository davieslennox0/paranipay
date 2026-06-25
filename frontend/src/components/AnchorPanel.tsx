import { useState } from "react";
import { ApiError, ProveResponse, buildVerifyTx, checkNullifier, verifyOffchain } from "../api";
import { signXdr, WalletState } from "../freighter";
import { pollTransaction, submitSignedTransaction } from "../soroban";
import { HashBox, truncate } from "./HashBox";
import { Stage } from "./ProofTimeline";
import { WalletConnect } from "./WalletConnect";

type Mode = "idle" | "working" | "onchain-cleared" | "offchain-cleared" | "error";

export function AnchorPanel({
  incoming,
  onStageChange,
}: {
  incoming: { proveResult: ProveResponse; context: string } | null;
  onStageChange: (s: Stage) => void;
}) {
  const [wallet, setWallet]       = useState<WalletState | null>(null);
  const [anchorId]                = useState("anchor_ph_remit");
  const [mode, setMode]           = useState<Mode>("idle");
  const [statusText, setStatusText] = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [txHash, setTxHash]       = useState<string | null>(null);

  async function handleVerify() {
    if (!incoming || !wallet) return;
    const { proveResult } = incoming;
    setMode("working");
    setError(null);
    setTxHash(null);

    try {
      setStatusText("Building verify_compliance transaction…");
      const { xdr } = await buildVerifyTx(
        wallet.address,
        anchorId,
        proveResult.encoded.proof,
        proveResult.encoded.public_signals
      );

      onStageChange("onchain");
      setStatusText("Waiting for Freighter signature…");
      const signed = await signXdr(xdr, wallet.networkPassphrase, wallet.address);

      setStatusText("Submitting to Soroban testnet…");
      const hash = await submitSignedTransaction(signed);
      setTxHash(hash);

      setStatusText("Waiting for the ledger to close…");
      const { status } = await pollTransaction(hash);
      if (status !== "SUCCESS") throw new Error(`Transaction did not succeed (status: ${status})`);

      onStageChange("cleared");
      setMode("onchain-cleared");
    } catch (e) {
      if (e instanceof ApiError && e.status === 501) {
        setStatusText("Contract not deployed — verifying proof off-chain instead…");
        try {
          const result = await verifyOffchain(proveResult.proof, proveResult.public_signals);
          if (!result.verified) throw new Error("off-chain verification failed");
          onStageChange("cleared");
          setMode("offchain-cleared");
          return;
        } catch (fallbackError) {
          setError(fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          setMode("error");
          return;
        }
      }
      setError(e instanceof Error ? e.message : String(e));
      setMode("error");
    }
  }

  async function handleCheckNullifier() {
    if (!incoming) return;
    try {
      const result = await checkNullifier(incoming.proveResult.encoded.public_signals[0]);
      setStatusText(
        result.used
          ? "Nullifier already recorded on-chain (replay correctly rejected if resubmitted)."
          : "Nullifier not yet used on-chain."
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  return (
    <div className="panel">
      <div className="panel-title anchor">Anchor — verify on Stellar</div>

      <div className="field">
        <WalletConnect onConnected={setWallet} />
      </div>

      {!incoming && <div className="muted">Waiting for the user to send a proof…</div>}

      {incoming && (
        <>
          <div className="muted" style={{ marginBottom: 10 }}>
            Received a proof for context <code>{incoming.context}</code>. The anchor sees only
            proof bytes, public signals, and a nullifier — no KYC attributes.
          </div>
          <HashBox>
            nullifier: <span className="accent">{truncate(incoming.proveResult.nullifier)}</span>
            <br />
            public signals: [{incoming.proveResult.public_signals.map((s) => truncate(s, 6, 4)).join(", ")}]
          </HashBox>

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="primary" onClick={handleVerify} disabled={!wallet || mode === "working"}>
              {mode === "working" ? <span className="spinner" /> : "Verify on Stellar"}
            </button>
            <button onClick={handleCheckNullifier} disabled={mode === "working"}>
              Check nullifier
            </button>
          </div>
          {!wallet && (
            <div className="muted" style={{ marginTop: 8 }}>
              Connect Freighter to sign the verification transaction.
            </div>
          )}

          {statusText && mode !== "idle" && (
            <div className="muted" style={{ marginTop: 10 }}>{statusText}</div>
          )}
          {txHash && (
            <div className="muted" style={{ marginTop: 4 }}>
              tx: {truncate(txHash, 10, 8)}
            </div>
          )}
          {error && <div className="error-text">{error}</div>}

          {(mode === "onchain-cleared" || mode === "offchain-cleared") && (
            <div className="payment-card unlocked">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge ok">ComplianceCleared</span>
                <span className="muted">
                  {mode === "onchain-cleared"
                    ? "verified on Stellar testnet"
                    : "verified off-chain (deploy contract for full on-chain flow)"}
                </span>
              </div>
              <div className="divider" />
              <div className="payment-row">
                <span>Payment</span>
                <span>$200.00 → Philippines</span>
              </div>
              <div className="payment-row">
                <span>Compliance check</span>
                <span style={{ color: "var(--green)" }}>Passed (zero-knowledge)</span>
              </div>
              <div className="payment-row">
                <span>Identity data shared with anchor</span>
                <span style={{ color: "var(--green)" }}>None</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
