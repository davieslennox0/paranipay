import { useState } from "react";
import { connectWallet, WalletState } from "../freighter";
import { truncate } from "./HashBox";

export function WalletConnect({ onConnected }: { onConnected: (w: WalletState) => void }) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const w = await connectWallet();
      setWallet(w);
      onConnected(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (wallet) {
    return (
      <span className="wallet-pill">
        {wallet.network} · {truncate(wallet.address, 6, 6)}
      </span>
    );
  }

  return (
    <div>
      <button onClick={handleConnect} disabled={busy}>
        {busy ? <span className="spinner" /> : "Connect Freighter"}
      </button>
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
