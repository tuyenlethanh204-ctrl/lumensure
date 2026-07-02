import { test } from "node:test";
import assert from "node:assert";
import { createOracle, makeOracleEvent, verifyEvent } from "./sign.mjs";

test("makeOracleEvent and verifyEvent", async () => {
  const oracle = createOracle();
  const event = await makeOracleEvent({
    policyId: 7n,
    value: 200n,
    timestamp: 1719600000n,
    nonce: 1n,
    oracle,
  });

  assert.strictEqual(event.policyId, 7n);
  assert.strictEqual(event.value, 200n);
  assert.strictEqual(event.timestamp, 1719600000n);
  assert.strictEqual(event.nonce, 1n);

  assert.ok(await verifyEvent(event, oracle));
});

test("mutated event value is rejected", async () => {
  const oracle = createOracle();
  const event = await makeOracleEvent({
    policyId: 7n,
    value: 200n,
    timestamp: 1719600000n,
    nonce: 1n,
    oracle,
  });
  const mutated = { ...event, value: 199n };
  assert.strictEqual(await verifyEvent(mutated, oracle), false);
});
