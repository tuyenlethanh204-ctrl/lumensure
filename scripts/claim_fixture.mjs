import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fieldBytes, makeOracleEvent } from "../oracle/sign.mjs";

const oracle = { secret: 123n };
const event = await makeOracleEvent({
  policyId: 1n,
  value: 200n,
  timestamp: 1719600000n,
  nonce: 42n,
  oracle,
});

const threshold = 180n;
const payoutRecipient = 123456789n;
const verifierDomain = 987654321n;
const publicInputs = [
  event.oracleCommitment,
  event.policyId,
  threshold,
  event.nullifier,
  event.oraclePublicKey.x,
  event.oraclePublicKey.y,
  payoutRecipient,
  verifierDomain,
  8n,
  9n,
  10n,
  11n,
  12n,
  13n,
  14n,
  15n,
  16n,
  17n,
];
const privateInputs = [
  ["value", event.value],
  ["timestamp", event.timestamp],
  ["nonce", event.nonce],
  ["signature_s", event.oracleSignature.s],
  ["signature_r8_x", event.oracleSignature.r8x],
  ["signature_r8_y", event.oracleSignature.r8y],
];
const publicInputBytes = Buffer.concat(publicInputs.map(fieldBytes));

const proverToml =
  [
    ...publicInputs.map((value, index) => {
      if (index === 6) return `payout_recipient = "${value}"`;
      if (index === 7) return `verifier_domain = "${value}"`;
      return `p${index} = "${value}"`;
    }),
    ...privateInputs.map(([name, value]) => `${name} = "${value}"`),
  ].join("\n") + "\n";
writeFileSync("circuits/claim/Prover.toml", proverToml);

const proverPipeline = [
  "cd /mnt/d/dorahack/stellar/zkinsure/circuits/claim",
  "rm -rf target",
  "~/.nargo/bin/nargo compile",
  "~/.nargo/bin/nargo execute",
  "~/.bb/bin/bb prove --scheme ultra_honk --oracle_hash keccak --bytecode_path target/claim.json --witness_path target/claim.gz --output_path target --output_format bytes_and_fields --crs_path /mnt/d/dorahack/stellar/zkinsure/.crs-bn254",
  "~/.bb/bin/bb write_vk --scheme ultra_honk --oracle_hash keccak --bytecode_path target/claim.json --output_path target --output_format bytes_and_fields --crs_path /mnt/d/dorahack/stellar/zkinsure/.crs-bn254",
  "~/.bb/bin/bb verify --scheme ultra_honk --oracle_hash keccak -k target/vk -p target/proof -i target/public_inputs --crs_path /mnt/d/dorahack/stellar/zkinsure/.crs-bn254",
].join(" && ");
const linuxEnv =
  "env -i HOME=/home/enzo95 USER=enzo95 PATH=/home/enzo95/.bb/bin:/home/enzo95/.nargo/bin:/home/enzo95/.local/bin:/usr/local/bin:/usr/bin:/bin";
const toolchainCheck =
  "if ! ~/.nargo/bin/nargo --version 2>/dev/null | grep -q '1.0.0-beta.9'; then ~/.nargo/bin/noirup -v 1.0.0-beta.9; fi";
const toolchainCommand =
  process.platform === "win32"
    ? `wsl.exe -d Ubuntu -- ${linuxEnv} bash -lc "${toolchainCheck}"`
    : `${linuxEnv} bash -lc "${toolchainCheck}"`;
const proverCommand =
  process.platform === "win32"
    ? `wsl.exe -d Ubuntu -- ${linuxEnv} bash -lc "${proverPipeline}"`
    : `${linuxEnv} bash -lc "${proverPipeline}"`;

console.log(
  `Generating witness, proof, VK, and native verification ${process.platform === "win32" ? "via WSL" : "inside WSL/Linux"}...`
);
execSync(toolchainCommand, { stdio: "inherit" });
execSync(proverCommand, { stdio: "inherit" });

const proofBlob = readFileSync("circuits/claim/target/proof");
const verifierPublicInputs = readFileSync("circuits/claim/target/public_inputs");
const verifierKey = readFileSync("circuits/claim/target/vk");
if (!verifierPublicInputs.equals(publicInputBytes)) {
  throw new Error("verifier public inputs do not match generated public inputs");
}

mkdirSync("artifacts", { recursive: true });
mkdirSync("evidence", { recursive: true });
writeFileSync("artifacts/public_inputs.bin", publicInputBytes);
writeFileSync("artifacts/proof_blob.bin", proofBlob);

const evidence = {
  project: "LumenSure++ Private Payout Rail",
  status: "EDDSA_POSEIDON_READY",
  network: "local",
  contractId: "soroban-test-env",
  transactionHashes: [],
  oracleModel:
    "Private value proof with in-circuit BabyJubJub EdDSA verification over a Poseidon oracle commitment",
  policyId: event.policyId.toString(),
  threshold: threshold.toString(),
  oracleCommitment: event.oracleCommitment.toString(),
  nullifier: event.nullifier.toString(),
  oraclePublicKeyX: event.oraclePublicKey.x.toString(),
  oraclePublicKeyY: event.oraclePublicKey.y.toString(),
  payoutRecipient: payoutRecipient.toString(),
  verifierDomain: verifierDomain.toString(),
  signatureScheme: "BabyJubJub EdDSA with PoseidonHasher challenge",
  publicInputsSha256: createHash("sha256").update(publicInputBytes).digest("hex"),
  proofBlobSha256: createHash("sha256").update(proofBlob).digest("hex"),
  verifyingKeyHash: createHash("sha256").update(verifierKey).digest("hex"),
  publicInputManifest: "evidence/public-input-manifest.json",
  acceptedFlow: "cargo test test_claim_success_payout accepts the proof-backed payout and marks the nullifier used",
  rejectedFlows: [
    "wrong policy id",
    "wrong product threshold",
    "wrong event commitment",
    "wrong nullifier",
    "wrong payout recipient",
    "wrong verifier domain",
    "mutated proof",
    "double claim replay",
    "expired policy",
    "stale oracle key",
    "missing oracle key"
  ],
  privacyBoundary:
    "Private witness values are generated locally and are not written to evidence: event value, timestamp, nonce, oracle signature, and policyholder witness.",
  trustedActors: ["policy administrator", "oracle key administrator"],
  mockedComponents: ["deterministic local oracle fixture"]
};

writeFileSync("artifacts/local-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`);
writeFileSync("evidence/local-latest.json", `${JSON.stringify(evidence, null, 2)}\n`);
writeFileSync(
  "evidence/verifier-artifacts.json",
  `${JSON.stringify(
    {
      status: evidence.status,
      proofSystem: "UltraHonk",
      oracleHash: "keccak",
      proofPath: "circuits/claim/target/proof",
      verifyingKeyPath: "circuits/claim/target/vk",
      publicInputsPath: "circuits/claim/target/public_inputs",
      proofBlobSha256: evidence.proofBlobSha256,
      verifyingKeyHash: evidence.verifyingKeyHash,
      publicInputsSha256: evidence.publicInputsSha256
    },
    null,
    2
  )}\n`
);
console.log("wrote artifacts/local-evidence.json");
