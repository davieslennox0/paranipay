module.exports = {
  apps: [
    {
      name: "stellarseal-backend",
      cwd: "./backend",
      script: "uvicorn",
      args: "app.main:app --host 0.0.0.0 --port 8420",
      interpreter: "none",
      env: {
        STELLAR_SEAL_REQUIRED_LEVEL: "2",
        STELLAR_SEAL_RPC_URL: "https://soroban-testnet.stellar.org",
        STELLAR_SEAL_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
        // Set after deploying contracts/stellar_seal (see its README):
        // STELLAR_SEAL_CONTRACT_ID: "C...",
        // STELLAR_SEAL_READER_ACCOUNT: "G...",
      },
    },
    {
      name: "stellarseal-frontend",
      cwd: "./frontend",
      script: "npm",
      args: "run dev -- --host 0.0.0.0",
      interpreter: "none",
      env: {
        VITE_BACKEND_URL: "http://localhost:8420",
        VITE_SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
      },
    },
  ],
};
