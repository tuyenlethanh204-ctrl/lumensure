import { randomBytes } from "node:crypto";
import * as circomlib from "circomlibjs";

export const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function canonicalField(value) {
  const n = BigInt(value);
  if (n < 0n || n >= FIELD_MODULUS) {
    throw new RangeError("value is outside the BN254 scalar field");
  }
  return n;
}

export function fieldBytes(value) {
  let n = canonicalField(value);
  const out = Buffer.alloc(32);
  for (let i = 31; i >= 0; i -= 1) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

const ORACLE_PRIVATE_KEY = 123n;
const ORACLE_SIGNATURE_NONCE =
  9876543210123456789098765432101234567890987654321n;

let cryptoPrimitives;

async function getCryptoPrimitives() {
  if (!cryptoPrimitives) {
    const [babyJub, poseidon] = await Promise.all([
      circomlib.buildBabyjub(),
      circomlib.buildPoseidon(),
    ]);
    cryptoPrimitives = { babyJub, poseidon };
  }
  return cryptoPrimitives;
}

function ffToBigInt(field, value) {
  return field.toObject(value);
}

export async function poseidonHash(values) {
  const { babyJub, poseidon } = await getCryptoPrimitives();
  return canonicalField(ffToBigInt(babyJub.F, poseidon(values.map((value) => babyJub.F.e(canonicalField(value))))));
}

export async function oraclePublicKey(secret = ORACLE_PRIVATE_KEY) {
  const { babyJub } = await getCryptoPrimitives();
  const point = babyJub.mulPointEscalar(babyJub.Generator, canonicalField(secret));
  return {
    x: canonicalField(ffToBigInt(babyJub.F, point[0])),
    y: canonicalField(ffToBigInt(babyJub.F, point[1])),
  };
}

export async function signOracleCommitment(
  commitment,
  { secret = ORACLE_PRIVATE_KEY, nonce = ORACLE_SIGNATURE_NONCE } = {}
) {
  const { babyJub, poseidon } = await getCryptoPrimitives();
  const privateKey = canonicalField(secret);
  const signatureNonce = BigInt(nonce) % babyJub.subOrder;
  const publicKeyPoint = babyJub.mulPointEscalar(babyJub.Generator, privateKey);
  const r8Point = babyJub.mulPointEscalar(babyJub.Base8, signatureNonce);
  const challenge = ffToBigInt(
    babyJub.F,
    poseidon([
      r8Point[0],
      r8Point[1],
      publicKeyPoint[0],
      publicKeyPoint[1],
      babyJub.F.e(canonicalField(commitment)),
    ])
  );
  const s = (signatureNonce + privateKey * challenge) % babyJub.subOrder;
  return {
    publicKey: {
      x: canonicalField(ffToBigInt(babyJub.F, publicKeyPoint[0])),
      y: canonicalField(ffToBigInt(babyJub.F, publicKeyPoint[1])),
    },
    s: canonicalField(s),
    r8: {
      x: canonicalField(ffToBigInt(babyJub.F, r8Point[0])),
      y: canonicalField(ffToBigInt(babyJub.F, r8Point[1])),
    },
  };
}

export function createOracle() {
  return { secret: BigInt(`0x${randomBytes(31).toString("hex")}`) };
}

export async function eventCommitment({ policyId, value, timestamp, nonce }) {
  return poseidonHash([policyId, value, timestamp, nonce]);
}

export async function nullifier({ policyId, timestamp, nonce }) {
  return poseidonHash([policyId, timestamp, nonce]);
}

export async function makeOracleEvent({ policyId, value, timestamp, nonce, oracle }) {
  const commitment = await eventCommitment({
    policyId,
    value,
    timestamp,
    nonce
  });
  const signature = await signOracleCommitment(commitment, { secret: oracle.secret });
  return {
    policyId: canonicalField(policyId),
    value: canonicalField(value),
    timestamp: canonicalField(timestamp),
    nonce: canonicalField(nonce),
    oracleCommitment: commitment,
    nullifier: await nullifier({ policyId, timestamp, nonce }),
    oraclePublicKey: signature.publicKey,
    oracleSignature: {
      s: signature.s,
      r8x: signature.r8.x,
      r8y: signature.r8.y,
    },
  };
}

export async function verifyEvent(event, oracle) {
  const publicKey = await oraclePublicKey(oracle.secret);
  return (
    event.oracleCommitment ===
      await eventCommitment({
      policyId: event.policyId,
      value: event.value,
      timestamp: event.timestamp,
      nonce: event.nonce
    }) &&
    event.oraclePublicKey.x === publicKey.x &&
    event.oraclePublicKey.y === publicKey.y
  );
}
