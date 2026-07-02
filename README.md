# LumenSure

**Private, proof-backed parametric insurance on Stellar.**

[Live testnet application](https://lumensure.vercel.app) · [Insurance contract](https://stellar.expert/explorer/testnet/contract/CBQ3WXWBRGDRUNYFMPYCFKSCL4KZOTAA3HDQHU7XVGEFWHXIHEQ3NQ53) · [Verified payout transaction](https://stellar.expert/explorer/testnet/tx/fec4fae1ee7c4a1c2a41db4dcf91614e521ef0b2c4a806bc154b811ccfd66ffa)

## Project overview

LumenSure is a zero-knowledge parametric insurance protocol built on Stellar and Soroban. It turns an externally observed event into an automatic insurance payout without requiring the policyholder to publish the underlying event value, timestamp, nonce, or oracle signature on-chain.

Traditional parametric insurance pays when an objective measurement crosses a predefined threshold—for example, rainfall falls below a minimum, a temperature exceeds a limit, a flight delay reaches a certain duration, or a sensor reports a qualifying condition. This model removes much of the subjective claims assessment found in conventional insurance, but it introduces a different trust problem: the contract must know that the measurement is authentic, belongs to the correct policy, satisfies the policy threshold, and has not already been used for another payout.

Publishing the raw measurement directly on-chain is simple, but it exposes policyholder and event data permanently. Accepting an opaque claim from an off-chain service preserves privacy, but forces the contract to trust that service. LumenSure resolves this tension by separating the private claim evidence from the public settlement conditions.

The oracle signs a Poseidon commitment to the event. The policyholder then generates an UltraHonk proof showing that:

- the hidden event value meets or exceeds the public product threshold;
- the public event commitment was computed from the correct policy identifier and private event data;
- the public nullifier was derived from the same policy and private event data;
- the commitment carries a valid BabyJubJub EdDSA signature from the active oracle key.

The Soroban contract does not receive the private value, timestamp, nonce, or signature. It receives the proof and the public inputs required to bind that proof to the policy, product threshold, published oracle commitment, nullifier, and currently registered oracle public key. A successful verification causes the contract to transfer the configured payout to the policyholder, mark the policy as paid, deactivate it, and persist the nullifier so the same claim cannot be replayed.

This repository contains a complete, testable claim path:

- deterministic oracle event construction and EdDSA signing;
- a Noir claim circuit using Poseidon and BabyJubJub EdDSA;
- UltraHonk proof and verification-key generation with Barretenberg;
- on-chain UltraHonk verification inside a Soroban insurance contract;
- policy purchase, event publication, payout, expiry, and replay-protection logic;
- an on-chain web application backed by live Stellar testnet reads.

The deployed testnet instance demonstrates a policy with a threshold of `180`, a privately proven event value of `200`, and a payout of `1000` native SAC units. The public claim transaction completed successfully, the policy is recorded as paid, and its nullifier is recorded as consumed.

## Security and cryptographic model

LumenSure combines cryptographic authenticity, private computation, and on-chain state checks. Each layer answers a different part of the claim-validation problem.

### Event commitment

The oracle event commitment is:

```text
commitment = Poseidon(policy_id, value, timestamp, nonce)
```

`policy_id` binds the event to one insurance policy. `value` is the private measurement used by the threshold rule. `timestamp` and `nonce` distinguish observations and prevent identical values from producing reusable claim material.

Only the commitment is published to the contract. The preimage remains private to the proof generator.

### Oracle authentication

The oracle signs the event commitment with BabyJubJub EdDSA. Signature verification runs inside the Noir circuit using a Poseidon-based challenge:

```text
EdDSA.verify(
  oracle_public_key,
  signature,
  event_commitment
)
```

The oracle public key is not compiled into the contract as a permanent fixture. The contract stores the active key coordinates and exposes the admin-authorized `set_oracle_key` operation. Because the active key is included in the proof's public inputs, rotating the registry key invalidates claims signed for the previous key unless the contract is deliberately rotated back.

### Private threshold evaluation

The product threshold is public and comes from contract storage. The measured event value remains private. The circuit proves:

```text
value >= threshold
```

The contract therefore learns that the policy condition was satisfied without learning the exact measurement.

### Nullifier and replay protection

The circuit derives:

```text
nullifier = Poseidon(policy_id, timestamp, nonce)
```

The nullifier links the proof to the same private event context without revealing that context. Before verification, the contract rejects any nullifier already present in persistent storage. After a successful payout, it stores the nullifier permanently. The policy is also marked `paid = true` and `active = false`, providing both claim-level and policy-level replay protection.

### On-chain proof binding

The Soroban contract constructs the verifier public-input byte sequence itself. It does not accept an arbitrary public-input blob from the claimant. The packed values come from authoritative contract state and the claim call:

- the oracle commitment previously published for the policy;
- the requested policy identifier;
- the threshold stored in the policy's product;
- the submitted nullifier;
- the active oracle public-key coordinates;
- verifier domain-separation marker fields.

The embedded verification key is loaded by the contract's `static-vk` feature, and `rs-soroban-ultrahonk` verifies the proof with the `nethermind-verifier` feature. A mutated proof, altered public input, wrong threshold, wrong oracle key, reused nullifier, missing event, expired policy, or inactive policy is rejected before settlement.

## Claim lifecycle

The protocol separates insurance administration, policy participation, oracle attestation, proof generation, and settlement.

1. **Initialize the pool.**  
   The administrator initializes the contract with an admin address and the token contract used for premiums and payouts.

2. **Register the oracle key.**  
   The administrator stores the active BabyJubJub public-key coordinates with `set_oracle_key`. This registry can be updated when the oracle key must be rotated.

3. **Create an insurance product.**  
   The administrator defines the premium, payout, and threshold. Each product is active when created and receives a sequential identifier.

4. **Purchase a policy.**  
   The holder authorizes `buy_policy`. The contract transfers the product premium from the holder into the insurance pool and records the holder, product, expiry time, active state, and payment state.

5. **Observe and sign the event.**  
   The oracle constructs a Poseidon commitment from the policy identifier and private event data, then signs that commitment with BabyJubJub EdDSA.

6. **Publish the commitment.**  
   The administrator publishes the oracle commitment for the policy. The contract stores it as the authoritative event commitment used during claim verification.

7. **Generate the claim proof.**  
   The claimant supplies the private event value, timestamp, nonce, and signature to the Noir circuit. The circuit checks the threshold, reconstructs the commitment and nullifier, and verifies the oracle signature.

8. **Submit the claim.**  
   The claimant calls `claim(policy_id, proof_blob, nullifier)`. The contract loads the policy, product, event commitment, and active oracle key, then packs the verifier public inputs.

9. **Verify and settle atomically.**  
   UltraHonk verification runs inside Soroban. If verification succeeds, the token contract transfers the payout to the policyholder. The same transaction consumes the nullifier and changes the policy to paid and inactive.

If any validation fails, the Soroban invocation reverts and no payout or state transition is committed.

## System architecture

### Oracle

`oracle/sign.mjs` implements the off-chain cryptographic primitives used by the fixture and tests:

- BN254 scalar-field canonicalization;
- fixed-width 32-byte field encoding;
- Poseidon event commitments and nullifiers;
- BabyJubJub public-key derivation;
- deterministic EdDSA signing of an event commitment;
- construction and local validation of oracle-event objects.

The oracle secret and deterministic signature nonce currently used by the fixture exist to make proof generation reproducible. The on-chain trust anchor is the registered public key, not the local secret value.

### Noir claim circuit

`circuits/claim/src/main.nr` is the private claim program. It imports Poseidon and EdDSA primitives and enforces the complete relationship among the policy, event, signature, threshold, and nullifier.

The circuit produces an UltraHonk-compatible proof. `scripts/claim_fixture.mjs` compiles the circuit, generates the witness, creates the proof, writes the verification key, performs a native Barretenberg verification, and confirms that the generated public-input bytes match the values expected by the Soroban contract.

### Soroban insurance contract

`contracts/insurance/src/lib.rs` implements `InsurancePool`. Its persistent state contains products, policies, published event commitments, and consumed nullifiers. Instance state contains the administrator, token address, sequence counters, and active oracle key.

The contract exposes operations for initialization, oracle-key rotation, product creation, policy purchase, event publication, claim settlement, and public state reads. Token movement uses the configured Soroban token contract, allowing premiums and payouts to be settled in the same asset.

### On-chain web application

The web application is generated by `web/build.mjs`. During the build, it reads the deployed Stellar testnet contract through non-mutating Stellar CLI invocations and writes an immutable snapshot alongside the static interface.

The displayed product, policy, oracle commitment, oracle key, nullifier status, contract balance, and transaction links originate from public testnet state. The application does not use `artifacts/local-evidence.json` as a substitute for deployed contract data.

## Circuit inputs and constraints

The verifier interface contains 18 public BN254 field elements:

| Index | Public value | Source |
|---:|---|---|
| `p0` | Oracle event commitment | Published policy event |
| `p1` | Policy identifier | Claim request and policy state |
| `p2` | Product threshold | Product stored on-chain |
| `p3` | Claim nullifier | Claim request |
| `p4` | Oracle public key X | Active contract registry |
| `p5` | Oracle public key Y | Active contract registry |
| `p6…p17` | Fixed values `6…17` | Verifier-compatible domain markers |

The private witness contains:

| Private value | Purpose |
|---|---|
| `value` | Measurement evaluated against the public threshold |
| `timestamp` | Event context used in commitment and nullifier derivation |
| `nonce` | Event uniqueness and nullifier derivation |
| `signature_s` | EdDSA scalar |
| `signature_r8_x` | EdDSA `R8` point X coordinate |
| `signature_r8_y` | EdDSA `R8` point Y coordinate |

The circuit accepts a claim only when all of the following constraints hold:

```text
value >= p2

p0 == Poseidon(p1, value, timestamp, nonce)

p3 == Poseidon(p1, timestamp, nonce)

EdDSA_Poseidon_Verify(
  public_key = (p4, p5),
  signature = (signature_s, signature_r8_x, signature_r8_y),
  message = p0
)

p6…p17 == 6…17
```

The public-input file contains `18 × 32 = 576` bytes in big-endian field representation. The contract reproduces this ordering exactly before calling the verifier.

## Soroban contract behavior

The insurance pool enforces business-state validation before invoking the cryptographic verifier:

| Condition | Contract response |
|---|---|
| Product or policy does not exist | Reject |
| Product or policy is inactive | Reject |
| Policy has reached its expiry timestamp | Reject |
| Policy has already been paid | Reject |
| Nullifier is already stored | Reject |
| No event is published for the policy | Reject |
| No oracle key is registered | Reject |
| Proof does not match contract-packed public inputs | Reject |
| Pool cannot transfer the configured payout | Revert |

On success, settlement occurs in this order within one Soroban transaction:

1. verify the UltraHonk proof;
2. transfer the product payout from the pool to the recorded holder;
3. persist the nullifier;
4. set `paid = true`;
5. set `active = false`;
6. persist the updated policy.

Soroban transaction atomicity ensures that a failed token transfer or state write cannot leave a partially settled claim.

## Stellar testnet deployment

The current deployment is verified on the Stellar testnet.

| Item | Value |
|---|---|
| Network | Stellar testnet |
| Insurance contract | `CBQ3WXWBRGDRUNYFMPYCFKSCL4KZOTAA3HDQHU7XVGEFWHXIHEQ3NQ53` |
| Native SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| WASM hash | `ab620c01803bb5535a5f56ecad2a3a48cbefcf1e5fc55820cca10e8e43f357d3` |
| Product | `0` |
| Demonstrated policy | `1` |
| Premium | `10` |
| Payout | `1000` |
| Threshold | `180` |
| Public application | [lumensure.vercel.app](https://lumensure.vercel.app) |

The verified claim transaction is:

```text
fec4fae1ee7c4a1c2a41db4dcf91614e521ef0b2c4a806bc154b811ccfd66ffa
```

[Open the claim transaction in Stellar Expert](https://stellar.expert/explorer/testnet/tx/fec4fae1ee7c4a1c2a41db4dcf91614e521ef0b2c4a806bc154b811ccfd66ffa)

Post-claim reads confirm:

- policy `1` is paid and inactive;
- the submitted nullifier is consumed;
- the native token transfer paid `1000` units to the policyholder;
- the contract retains a balance of `20`, corresponding to two collected premiums after the funded reserve payout.

Detailed deployment transactions and read-back evidence are recorded in [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md).

## Installation, proof generation, and verification

### Prerequisites

- Node.js 20 or newer;
- Rust with the `wasm32v1-none` target;
- WSL 2 with Ubuntu when running the proof pipeline on Windows;
- Nargo compatible with the claim circuit;
- Barretenberg `bb` compatible with the UltraHonk artifacts;
- Stellar CLI for testnet contract reads and deployment operations.

Soroban SDK 26 uses the `wasm32v1-none` target. Do not build this contract with `wasm32-unknown-unknown`.

### Install dependencies

```powershell
cd D:\dorahack\stellar\zkinsure
npm install
rustup target add wasm32v1-none
```

### Run oracle and fixture tests

```powershell
npm test
```

### Run Noir circuit tests

```powershell
wsl.exe -d Ubuntu -- bash -lc `
  'cd /mnt/d/dorahack/stellar/zkinsure && ~/.nargo/bin/nargo test --program-dir circuits/claim'
```

The circuit test suite includes a valid claim and rejection cases for a value below the threshold, an incorrect commitment, an incorrect nullifier, and an invalid signature.

### Generate and verify the UltraHonk proof

```powershell
npm run proof:fixture
```

This command:

1. creates the deterministic signed oracle event;
2. writes `circuits/claim/Prover.toml`;
3. compiles and executes the Noir circuit;
4. generates the UltraHonk proof and verification key;
5. verifies the proof natively with `bb verify`;
6. validates the public-input byte ordering;
7. exports the proof, public inputs, and evidence hashes.

### Test the Soroban contract

```powershell
wsl.exe -d Ubuntu -- bash -lc `
  'cd /mnt/d/dorahack/stellar/zkinsure && cargo test --manifest-path contracts/insurance/Cargo.toml -- --nocapture'
```

The contract tests cover successful settlement, missing events, missing oracle keys, policy expiry, replayed claims, mutated proofs, mutated public inputs, incorrect thresholds, incorrect oracle keys, and key rotation.

### Build the contract

```powershell
wsl.exe -d Ubuntu -- bash -lc `
  'cd /mnt/d/dorahack/stellar/zkinsure && cargo build --manifest-path contracts/insurance/Cargo.toml --target wasm32v1-none --release'
```

### Build the on-chain web application

```powershell
npm run web:build
```

The web build requires access to the configured Stellar testnet network and identity because it performs live read-only contract invocations. It writes the application to `web/dist/index.html` and the normalized chain data to `web/dist/onchain-snapshot.json`.

### Run the complete verification sequence

```powershell
npm test
npm run proof:fixture
wsl.exe -d Ubuntu -- bash -lc `
  'cd /mnt/d/dorahack/stellar/zkinsure && ~/.nargo/bin/nargo test --program-dir circuits/claim'
wsl.exe -d Ubuntu -- bash -lc `
  'cd /mnt/d/dorahack/stellar/zkinsure && cargo test --manifest-path contracts/insurance/Cargo.toml -- --nocapture'
wsl.exe -d Ubuntu -- bash -lc `
  'cd /mnt/d/dorahack/stellar/zkinsure && cargo build --manifest-path contracts/insurance/Cargo.toml --target wasm32v1-none --release'
npm run web:build
```
