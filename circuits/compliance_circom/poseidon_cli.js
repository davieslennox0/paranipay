// Small JSON-over-stdio helper so the Python backend can reuse this
// repo's one real Poseidon implementation (circomlibjs) instead of
// re-deriving round constants in Python, which would risk silently
// diverging from what the circuit actually checks.
//
// Usage: echo '{"op": "...", ...}' | node poseidon_cli.js
//
// ops:
//   commitment   {kyc_level, age, jurisdiction_hash, salt} -> {commitment}
//   nullifier    {user_secret, context}                    -> {nullifier}
//   merkle_path  {leaves: [...0/1 ints, len 256], index}   -> {root, path_indices, path_elements}
const { buildPoseidon } = require("circomlibjs");

async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const H2 = (a, b) => F.toObject(poseidon([BigInt(a), BigInt(b)]));
  const H4 = (a, b, c, d) => F.toObject(poseidon([BigInt(a), BigInt(b), BigInt(c), BigInt(d)]));

  const input = JSON.parse(await readStdin());
  let output;

  if (input.op === "commitment") {
    const { kyc_level, age, jurisdiction_hash, salt } = input;
    output = { commitment: H4(kyc_level, age, jurisdiction_hash, salt).toString() };
  } else if (input.op === "nullifier") {
    const { user_secret, context } = input;
    output = { nullifier: H2(user_secret, context).toString() };
  } else if (input.op === "merkle_path") {
    const DEPTH = 8;
    const leaves = input.leaves.map((l) => BigInt(l));
    if (leaves.length !== 1 << DEPTH) throw new Error("leaves must have 256 entries");

    const levels = [leaves];
    for (let d = 0; d < DEPTH; d++) {
      const prev = levels[levels.length - 1];
      const next = [];
      for (let i = 0; i < prev.length; i += 2) next.push(H2(prev[i], prev[i + 1]));
      levels.push(next);
    }
    const root = levels[DEPTH][0];

    let idx = input.index;
    const path_indices = [];
    const path_elements = [];
    for (let d = 0; d < DEPTH; d++) {
      const levelNodes = levels[d];
      const isRight = idx % 2;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      path_indices.push(isRight);
      path_elements.push(levelNodes[siblingIdx].toString());
      idx = Math.floor(idx / 2);
    }
    output = { root: root.toString(), path_indices, path_elements };
  } else {
    throw new Error("unknown op: " + input.op);
  }

  process.stdout.write(JSON.stringify(output));
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

main().catch((e) => {
  process.stderr.write(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
