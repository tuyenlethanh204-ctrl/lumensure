import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('evidence/public-input-manifest.json', 'utf8'));
const testnet = JSON.parse(readFileSync('evidence/testnet-latest.json', 'utf8'));

describe('Replay and stale-state evidence coverage', () => {
  it('records replay and stale oracle-key rejection coverage', () => {
    expect(manifest.mutationCoverage).toEqual(
      expect.arrayContaining(['double claim replay', 'expired policy', 'stale oracle key']),
    );
  });

  it('records accepted testnet state without private witness data', () => {
    expect(testnet.finalState).toMatchObject({
      policyPaid: true,
      nullifierUsed: true,
    });
    expect(testnet).not.toHaveProperty("value");
    expect(testnet).not.toHaveProperty("timestamp");
    expect(testnet).not.toHaveProperty("nonce");
    expect(testnet).not.toHaveProperty("oracleSignature");
    expect(testnet).not.toHaveProperty("privateInputs");
  });
});
