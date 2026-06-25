# StellarSeal

Zero-knowledge KYC compliance for Stellar anchors. Users prove they meet compliance requirements without revealing any personal data to the anchor.

## What it does

A user wants to send $200 through a Stellar anchor. Instead of submitting a passport or identity documents, they:

1. Request a signed KYC attestation from the oracle (Ed25519 commitment over jurisdiction, KYC tier, age)
2. Generate a Groth16/BN254 ZK proof that their attributes satisfy the anchor's compliance predicate
3. Submit the proof to the anchor — the anchor verifies it on Stellar Soroban and learns nothing about who the user is

The proof is verified using Protocol 26 native host functions on Soroban. A nullifier prevents replay attacks.

## Architecture

```
frontend/          React 18 + Vite 5 + TypeScript
  src/
    App.tsx        Single-page landing with embedded live simulation
    api.ts         Typed fetch client for the FastAPI backend
    freighter.ts   Freighter wallet adapter (v6 API)
    soroban.ts     Soroban JSON-RPC client (submit + poll)
    components/
      SimulationPage.tsx   Auto-playing Maria / Lucas demo
      UserPanel.tsx        Interactive proof generation
      AnchorPanel.tsx      Verification + Freighter signing
      ProofTimeline.tsx    Stage progress indicator

backend/           FastAPI + uvicorn (Python 3.11)
  app/
    main.py        REST API — /attest, /prove, /verify/*
    attestation.py Ed25519 oracle signing, Poseidon commitment
    prover.py      snarkjs proof generation via subprocess
    chain.py       Soroban XDR construction for verify_compliance

circuits/
  compliance_circom/
    poseidon_cli.js        Node.js CLI for Poseidon hashing (circomlibjs)
    build/
      compliance.wasm      Compiled circuit (Circom 2)
      compliance_final.zkey Groth16 proving key (BN254)
      verification_key.json Verifier parameters
```

## Running locally

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8420 --reload
```

Requires Node.js for `poseidon_cli.js` and `snarkjs`. The oracle Ed25519 key is generated automatically at `backend/oracle_key.json` on first run.

**Frontend**
```bash
cd frontend
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build to frontend/dist/
```

Set `VITE_BACKEND_URL` in `.env.local` to point at the backend (default: `http://localhost:8420`). Leave it empty for production with a reverse proxy routing `/attest`, `/prove`, `/verify/*`, `/tx/*` to the backend.

## Production deployment

Caddy reverse proxy config:
```
paranipay.duckdns.org {
    encode gzip
    handle /attest*  { reverse_proxy localhost:8420 }
    handle /prove*   { reverse_proxy localhost:8420 }
    handle /verify*  { reverse_proxy localhost:8420 }
    handle /tx/*     { reverse_proxy localhost:8420 }
    handle {
        root * /path/to/frontend/dist
        try_files {path} /index.html
        file_server
    }
}
```

Backend managed by pm2:
```bash
pm2 start ecosystem.config.js
pm2 save
```

## Tech stack

- **ZK circuit** — Circom 2, Groth16/BN254, snarkjs
- **Hash function** — Poseidon (circuit-friendly)
- **Oracle signatures** — Ed25519 (PyNaCl)
- **Blockchain** — Stellar Soroban testnet, Protocol 26
- **Wallet** — Freighter (Stellar browser extension)
- **Backend** — FastAPI, Python 3.11, uvicorn
- **Frontend** — React 18, Vite 5, TypeScript, IBM Plex fonts

## Live demo

[paranipay.duckdns.org](https://paranipay.duckdns.org)

## License

MIT
