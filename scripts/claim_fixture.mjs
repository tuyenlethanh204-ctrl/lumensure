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
const publicInputs = [
  event.oracleCommitment,
  event.policyId,
  threshold,
  event.nullifier,
  event.oraclePublicKey.x,
  event.oraclePublicKey.y,
  6n,
  7n,
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
    ...publicInputs.map((value, index) => `p${index} = "${value}"`),
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
const proverCommand =
  process.platform === "win32"
    ? `wsl.exe -d Ubuntu -- ${linuxEnv} bash -lc "${proverPipeline}"`
    : `${linuxEnv} bash -lc "${proverPipeline}"`;

console.log(
  `Generating witness, proof, VK, and native verification ${process.platform === "win32" ? "via WSL" : "inside WSL/Linux"}...`
);
execSync(proverCommand, { stdio: "inherit" });

const proofBlob = readFileSync("circuits/claim/target/proof");
const verifierPublicInputs = readFileSync("circuits/claim/target/public_inputs");
if (!verifierPublicInputs.equals(publicInputBytes)) {
  throw new Error("verifier public inputs do not match generated public inputs");
}

mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/public_inputs.bin", publicInputBytes);
writeFileSync("artifacts/proof_blob.bin", proofBlob);

const evidence = {
  status: "EDDSA_POSEIDON_READY",
  oracleModel:
    "Private value proof with in-circuit BabyJubJub EdDSA verification over a Poseidon oracle commitment",
  policyId: event.policyId.toString(),
  value: event.value.toString(),
  threshold: threshold.toString(),
  timestamp: event.timestamp.toString(),
  nonce: event.nonce.toString(),
  oracleCommitment: event.oracleCommitment.toString(),
  nullifier: event.nullifier.toString(),
  oraclePublicKeyX: event.oraclePublicKey.x.toString(),
  oraclePublicKeyY: event.oraclePublicKey.y.toString(),
  signatureScheme: "BabyJubJub EdDSA with PoseidonHasher challenge",
  publicInputsSha256: createHash("sha256").update(publicInputBytes).digest("hex"),
  proofBlobSha256: createHash("sha256").update(proofBlob).digest("hex"),
};

writeFileSync("artifacts/local-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log("wrote artifacts/local-evidence.json");
