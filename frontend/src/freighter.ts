import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

export interface WalletState {
  address: string;
  networkPassphrase: string;
  network: string;
}

export async function connectWallet(): Promise<WalletState> {
  const connResult = await isConnected();
  const connected = typeof connResult === "boolean" ? connResult : (connResult as { isConnected: boolean }).isConnected;
  if (!connected) throw new Error("Freighter not found — install it at freighter.app");

  await requestAccess();

  const addrResult = await getAddress();
  const address = typeof addrResult === "string" ? addrResult : (addrResult as { address: string }).address;

  const netResult = await getNetwork();
  const networkPassphrase =
    typeof netResult === "string"
      ? netResult
      : (netResult as { networkPassphrase: string }).networkPassphrase;
  const network =
    typeof netResult === "object" && "network" in (netResult as object)
      ? (netResult as { network: string }).network
      : "testnet";

  return { address, networkPassphrase, network };
}

export async function signXdr(
  xdr: string,
  networkPassphrase: string,
  address: string
): Promise<string> {
  const result = await signTransaction(xdr, { networkPassphrase, address });
  if (typeof result === "string") return result;
  const r = result as { signedTxXdr?: string; error?: string };
  if (r.error) throw new Error(r.error);
  return r.signedTxXdr ?? (result as string);
}
