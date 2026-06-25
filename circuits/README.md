# ParaniPay circuits

There are two implementations of the **same** compliance predicate here, on
purpose — see the root [README](../README.md#why-two-circuits) for the full
rationale. Short version: Noir's Barretenberg backend produces UltraHonk
proofs, which Soroban/Protocol 26's new cheap host functions (BN254
multi-scalar-multiplication, scalar-field arithmetic, curve-membership
checks) do not accelerate — those host functions are built for
Groth16-shaped pairing checks. So:

- **`compliance/`** (Noir) is the reference specification of the compliance
  logic, written the way you'd actually ship a Noir circuit. It is the
  circuit this whole project is "about."
- **`compliance_circom/`** (Circom) is a field-for-field identical circuit,
  compiled to Groth16/BN254, which is what the demo actually proves and what
  the Soroban contract actually verifies on-chain.

Both prove: `kyc_level >= required_level`, `age >= 18`, sanctions-list
exclusion via an 8-level sparse Merkle proof, and an attestation-commitment
check binding the witness to the KYC oracle's signed attestation. Both
output `nullifier = Poseidon(user_secret, context)`.

## compliance_circom (executed by this repo)

```bash
cd compliance_circom
npm install                       # circomlib + circomlibjs
circom compliance.circom --r1cs --wasm --sym -o build
node build_sanctions_tree.js      # writes build/input.json (sample witness)

# one-time trusted setup (demo-grade — see caveat below)
curl -o build/pot12_final.ptau https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau
cd build
snarkjs groth16 setup compliance.r1cs pot12_final.ptau compliance_0000.zkey
snarkjs zkey contribute compliance_0000.zkey compliance_final.zkey --name="your entropy"
snarkjs zkey export verificationkey compliance_final.zkey verification_key.json

node compliance_js/generate_witness.js compliance_js/compliance.wasm input.json witness.wtns
snarkjs groth16 prove compliance_final.zkey witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json   # => OK!
```

This was run for real while building this repo — `build/` contains the
actual r1cs, wasm, zkey, verification key, sample proof and public signals
produced by that run. The backend's `/prove` and `/verify` endpoints shell
out to this same `compliance_js/generate_witness.js` + `snarkjs` pipeline at
request time; nothing about proof generation is mocked.

**Trusted setup caveat:** the Powers-of-Tau file used here is a public,
well-known ceremony transcript (Hermez phase 1), and the circuit-specific
phase-2 contribution was done with throwaway entropy generated in this repo
— fine for a testnet demo, not something you'd reuse for a production
deployment securing real funds.

## compliance (Noir reference, not compiled in this environment)

This sandbox has no `nargo`/`bb` (Barretenberg) — installing the Rust +
Noir toolchain needs more disk/RAM than was available while building this.
On a normal machine:

```bash
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash
bbup

cd compliance
nargo check
nargo execute            # fill in Prover.toml from a real /attest response first
bb prove -b ./target/compliance.json -w ./target/compliance.gz -o ./target/proof
bb write_vk -b ./target/compliance.json -o ./target/vk
bb verify -k ./target/vk -p ./target/proof   # => verified
```
