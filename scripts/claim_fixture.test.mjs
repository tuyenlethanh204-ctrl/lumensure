import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("local evidence fixture is honest about production semantics boundary", async () => {
  await import("./claim_fixture.mjs");
  const evidence = JSON.parse(readFileSync("artifacts/local-evidence.json", "utf8"));
  assert.equal(evidence.status, "EDDSA_POSEIDON_READY");
  assert.match(evidence.oracleModel, /in-circuit BabyJubJub EdDSA verification/);
  assert.equal(evidence.threshold, "180");
  assert.equal(evidence.signatureScheme, "BabyJubJub EdDSA with PoseidonHasher challenge");
});
