/**
 * TalentLens AI — Deploy Script (Pure Node.js, no ethers/viem needed)
 *
 * Uses raw JSON-RPC over HTTP to deploy the contract to a running Hardhat node.
 * No extra npm packages required beyond what Hardhat already installs.
 *
 * Usage:
 *   Terminal 1:  npx hardhat node
 *   Terminal 2:  node scripts/deploy.js
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RPC_URL = "http://127.0.0.1:8545";
const ARTIFACT_PATH = path.join(
  __dirname, "..", "artifacts", "contracts",
  "TalentLensHiring.sol", "TalentLensHiring.json"
);

// ─── JSON-RPC helper ──────────────────────────────────────────────────────────
let _id = 1;
function rpc(method, params = []) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: _id++, method, params });
    const req = http.request(
      {
        hostname: "127.0.0.1", port: 8545, path: "/", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(json.error.message));
          else resolve(json.result);
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── Wait for tx receipt ─────────────────────────────────────────────────────
async function waitForReceipt(txHash, retries = 30) {
  for (let i = 0; i < retries; i++) {
    const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
    if (receipt) return receipt;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Receipt not found after timeout");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 TalentLens AI — Deploying to Local Hardhat Node\n");

  // 1. Check node is alive
  try {
    await rpc("eth_blockNumber");
  } catch {
    console.error("❌ Cannot reach Hardhat node at http://127.0.0.1:8545");
    console.error("   Run `npx hardhat node` in another terminal first.");
    process.exit(1);
  }

  // 2. Load compiled artifact
  if (!fs.existsSync(ARTIFACT_PATH)) {
    console.error("❌ Artifact not found. Run `npx hardhat compile` first.");
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
  const { abi, bytecode } = artifact;
  console.log(`📄 Contract:  TalentLensHiring`);
  console.log(`📦 Bytecode:  ${bytecode.length / 2} bytes\n`);

  // 3. Get deployer account (first pre-funded Hardhat account)
  const accounts = await rpc("eth_accounts");
  const deployer = accounts[0];
  const balanceHex = await rpc("eth_getBalance", [deployer, "latest"]);
  const balanceEth = (parseInt(balanceHex, 16) / 1e18).toFixed(2);
  console.log(`👤 Deployer:  ${deployer}`);
  console.log(`💰 Balance:   ${balanceEth} ETH (fake)\n`);

  // 4. Send deploy transaction (bytecode only = constructor call)
  const txHash = await rpc("eth_sendTransaction", [{
    from: deployer,
    data: bytecode,
    gas: "0x1E8480",   // 2,000,000 gas
  }]);
  console.log(`📨 Tx sent:   ${txHash}`);

  // 5. Wait for receipt
  const receipt = await waitForReceipt(txHash);
  const contractAddress = receipt.contractAddress;
  const blockNumber = parseInt(receipt.blockNumber, 16);

  console.log(`\n✅ Contract deployed!`);
  console.log(`   Address:  ${contractAddress}`);
  console.log(`   Block:    ${blockNumber}`);
  console.log(`   Network:  Local Hardhat (chainId 31337)`);
  console.log(`   RPC:      http://127.0.0.1:8545\n`);

  // 6. Save deployment.json
  const deployment = {
    contract_address: contractAddress,
    transaction_hash: txHash,
    block_number: blockNumber,
    network: "hardhat_local",
    chain_id: 31337,
    rpc_url: RPC_URL,
    deployer,
    deployed_at: new Date().toISOString(),
    abi,
  };

  const outDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "deployment.json"), JSON.stringify(deployment, null, 2));

  console.log(`💾 Saved → artifacts/deployment.json`);
  console.log(`\n📋 Add to your backend .env:`);
  console.log(`   CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`   BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545`);
  console.log(`\n✨ Done! The TalentLens blockchain is live.\n`);
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exit(1);
});
