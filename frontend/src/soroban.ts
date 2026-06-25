const RPC = import.meta.env.VITE_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

async function rpc<T = Record<string, unknown>>(method: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data.result as T;
}

export async function submitSignedTransaction(signedXdr: string): Promise<string> {
  const result = await rpc<{ status: string; hash: string; errorResultXdr?: string }>(
    "sendTransaction",
    { transaction: signedXdr }
  );
  if (result.status === "ERROR") {
    throw new Error(`Transaction rejected: ${result.errorResultXdr ?? result.status}`);
  }
  return result.hash;
}

export async function pollTransaction(hash: string): Promise<{ status: string }> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await rpc<{ status: string }>("getTransaction", { hash });
    if (result.status !== "NOT_FOUND") return { status: result.status };
  }
  throw new Error("Transaction timed out after 60 seconds");
}
