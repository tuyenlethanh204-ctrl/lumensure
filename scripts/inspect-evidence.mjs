import fs from "fs";
import crypto from "crypto";

const EVIDENCE_DIR = "evidence";
const LOCAL_JSON = `${EVIDENCE_DIR}/local-latest.json`;
const TESTNET_JSON = `${EVIDENCE_DIR}/testnet-latest.json`;
const VK_PATH = "circuits/claim/target/vk";
const AUDITOR_RECEIPT = `${EVIDENCE_DIR}/auditor-receipt.json`;

let vkHash = "Not available";
if (fs.existsSync(VK_PATH)) {
  const vkBuf = fs.readFileSync(VK_PATH);
  vkHash = crypto.createHash("sha256").update(vkBuf).digest("hex");
}

function processEvidence(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.log(`[${label}] File not found: ${filePath}`);
    return null;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  
  console.log(`\n=== ${label} Evidence Inspector ===`);
  console.log(`Proof Hash:          ${data.proofBlobSha256 || "Not available"}`);
  console.log(`Verification-Key Hash: ${vkHash}`);
  console.log(`Contract ID:         ${data.contractId || "Not available"}`);
  console.log(`Transaction Hash:    ${data.transactionHash || "Not available"}`);
  console.log(`Final State:         Paid=${data.paid || "Not available"}, Active=${data.active || "Not available"}`);
  
  return {
    environment: label,
    proofHash: data.proofBlobSha256,
    vkHash: vkHash,
    contractId: data.contractId,
    transactionHash: data.transactionHash,
    finalState: {
      paid: data.paid,
      active: data.active
    },
    oracleCommitment: data.oracleCommitment,
    nullifier: data.nullifier,
    timestamp: new Date().toISOString()
  };
}

const localReceipt = processEvidence(LOCAL_JSON, "Local");
const testnetReceipt = processEvidence(TESTNET_JSON, "Testnet");

const receiptData = {
  generatedAt: new Date().toISOString(),
  local: localReceipt,
  testnet: testnetReceipt
};

fs.writeFileSync(AUDITOR_RECEIPT, JSON.stringify(receiptData, null, 2));
console.log(`\nAuditor receipt generated: ${AUDITOR_RECEIPT}`);
