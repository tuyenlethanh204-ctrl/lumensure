import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('evidence/public-input-manifest.json', 'utf8'));

describe('Public input manifest coverage', () => {
  it('documents ordered public inputs and encoding', () => {
    expect(manifest.fieldEncoding).toContain('32-byte big-endian');
    expect(manifest.publicInputs.map((field: { name: string }) => field.name)).toEqual([
      'event_commitment',
      'policy_id',
      'product_threshold',
      'nullifier',
      'oracle_public_key_x',
      'oracle_public_key_y',
      'payout_recipient',
      'verifier_domain',
      'marker_fields',
    ]);
  });

  it('tracks mutation coverage for each meaningful public input', () => {
    expect(manifest.mutationCoverage).toEqual(
      expect.arrayContaining([
        'wrong policy id',
        'wrong product threshold',
        'wrong event commitment',
        'wrong nullifier',
        'wrong payout recipient',
        'wrong verifier domain',
        'mutated proof',
      ]),
    );
  });
});
