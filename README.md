# LumenSure

Private, proof-backed parametric insurance on Stellar.

[Live dashboard](https://lumensure.vercel.app) |
[Demo video](https://youtu.be/6vrBw4l9up0) |
[Insurance contract](https://stellar.expert/explorer/testnet/contract/CBMRHKVESDGT54LRSHVFQ2F7OS6O4VKZ2665RAT4BGVNKS3BHZK6TIYW) |
[Verified payout transaction](https://stellar.expert/explorer/testnet/tx/0c9aafdff6461833c099ed93a28d5bc9d92b8ff1835fcd4d05abdc7f8bc5b5b6)

## Overview

LumenSure is a zero-knowledge payout rail for parametric insurance. A policy can be paid when an oracle-signed event satisfies a public policy threshold, while the underlying event value, timestamp, nonce, and oracle signature remain off-chain.

The deployed demo proves and settles one insurance claim on Stellar testnet:

- product `0` defines a premium of `10`, payout of `1000`, and threshold of `180`;
- policy `1` is bound to a private oracle event;
- the claim proof verifies that the hidden event satisfies the threshold and was signed by the active oracle key;
- the Soroban contract pays the policyholder, marks the policy as paid, deactivates it, and stores the nullifier;
- replay, stale oracle key, wrong policy, wrong commitment, wrong nullifier, wrong recipient, and wrong verifier-domain cases are covered by local tests.

The project is hackathon-grade infrastructure, not a production insurance product. The oracle fixture is deterministic and local; the on-chain verifier, policy state, nullifier state, reserve transfer, and payout transaction are live on Stellar testnet.

## Current Testnet Deployment

| Item | Value |
| --- | --- |
| Network | Stellar testnet |
| Network passphrase | `Test SDF Network ; September 2015` |
| Dashboard | <https://lumensure.vercel.app> |
| Demo video | <https://youtu.be/6vrBw4l9up0> |
| Insurance contract | `CBMRHKVESDGT54LRSHVFQ2F7OS6O4VKZ2665RAT4BGVNKS3BHZK6TIYW` |
| Native SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| WASM hash | `1002df92bb57042947bee3e1e66eabbeb9b7275edc4729786878a665e217f306` |
| Product | `0` |
| Demonstrated policy | `1` |
| Premium | `10` |
| Payout | `1000` |
| Threshold | `180` |
| Oracle commitment | `1a5ba115182cb8e9f6dfa6cfe7c5fe99b02bd0134829731850006fb540f0feb2` |
| Nullifier | `01b0c7c47ce498044496c78ded485186f5bc7c5254a0a77e3abda249f5596758` |
| Claim transaction | `0c9aafdff6461833c099ed93a28d5bc9d92b8ff1835fcd4d05abdc7f8bc5b5b6` |
| Vercel deployment | `dpl_76FH2os8D7wybx7ruGPdVLGfe1in` |

Post-claim readbacks:

- `get_policy(1)` returns `paid=true` and `active=false`;
- `nullifier_used(nullifier)` returns `true`;
- the native token event transfers `1000` units from the insurance contract to the deployer account;
- the insurance contract balance is `20`, matching two collected premiums after the reserve payout.

Detailed deployment records:

- `TESTNET_DEPLOYMENT.md`
- `evidence/testnet-latest.json`
- `evidence/testnet-links.md`
- `evidence/testnet-deploy-2026-07-03.log`
- `web/dist/onchain-snapshot.json`

## Proof Model

### Proof statement

The claimant knows oracle-signed event data bound to the policy; the hidden event satisfies the public threshold; the nullifier is derived from the same event and has not been consumed.

### Private witness

The following values are used to generate the proof and are not stored in evidence or submitted to the contract:

- event value;
- event timestamp;
- event nonce;
- oracle signature scalar and point;
- local policyholder claim witness.

### Public inputs

The verifier input is encoded as 18 big-endian 32-byte BN254 field elements.

| Index | Public value | Source |
| ---: | --- | --- |
| `p0` | Oracle event commitment | Contract event storage |
| `p1` | Policy id | Claim argument and policy storage |
| `p2` | Product threshold | Product storage |
| `p3` | Nullifier | Claim argument |
| `p4` | Oracle public key X | Contract oracle-key registry |
| `p5` | Oracle public key Y | Contract oracle-key registry |
| `p6` | Payout recipient field | Claim argument |
| `p7` | Verifier domain | Claim argument |
| `p8..p17` | Fixed marker fields `8..17` | Contract public-input packing |

The implementation manifest is stored at `evidence/public-input-manifest.json`.

### Circuit constraints

The Noir circuit in `circuits/claim/src/main.nr` enforces:

```text
event_commitment == Poseidon(policy_id, value, timestamp, nonce)
nullifier == Poseidon(policy_id, timestamp, nonce)
value >= product_threshold
BabyJubJub_EdDSA_Poseidon_Verify(oracle_public_key, signature, event_commitment)
payout_recipient == 123456789
verifier_domain == 987654321
marker_fields == 8..17
```

The fixture writes the payout recipient and verifier domain as 32-byte public input fields:

- payout recipient: `00000000000000000000000000000000000000000000000000000000075bcd15`
- verifier domain: `000000000000000000000000000000000000000000000000000000003ade68b1`

## Contract Behavior

The Soroban contract in `contracts/insurance/src/lib.rs` owns the policy state and reconstructs the verifier input from contract storage and trusted claim arguments. It does not accept an arbitrary public-input blob from the caller.

Settlement checks include:

- product exists and is active;
- policy exists, is active, has not expired, and has not been paid;
- oracle event commitment has been published for the policy;
- active oracle key has been registered;
- nullifier has not been consumed;
- proof verifies against the contract-packed public inputs;
- token payout transfer succeeds.

On success, the contract transfers the payout, stores the nullifier, marks the policy as paid, deactivates the policy, and persists the updated state in one transaction.

## Privacy And Trust Boundary

| Category | Status |
| --- | --- |
| Private | Event value, timestamp, nonce, oracle signature, local witness material |
| Public on testnet | Contract id, transaction hashes, product data, policy id, event commitment, nullifier, oracle public key, payout recipient field, verifier domain, final policy state |
| Trusted roles | Policy administrator and oracle-key administrator |
| Mocked component | The oracle event generator is a deterministic local fixture, not an independent live oracle service |
| Live component | Soroban contract verification, token transfers, policy state, event commitment, nullifier state, and public dashboard snapshot |

The project proves claim eligibility without publishing the underlying event measurement. It does not hide the fact that a claim was made, the policy id, the public commitment, the nullifier, or the payout transaction.

## Evidence Files

| File | Purpose |
| --- | --- |
| `evidence/local-latest.json` | Local proof, public input, verifier, and privacy-boundary summary |
| `evidence/testnet-latest.json` | Contract id, tx hashes, proof hash, VK hash, final state, dashboard deployment |
| `evidence/testnet-links.md` | Explorer and dashboard links |
| `evidence/public-input-manifest.json` | Field order and public-input binding |
| `evidence/verifier-artifacts.json` | Proof blob, public input, and verification-key hashes |
| `evidence/mutation-results.json` | Negative test summary |
| `evidence/auditor-receipt.json` | Compact reviewer receipt |
| `web/dist/onchain-snapshot.json` | Static dashboard snapshot generated from live testnet reads |

## Project Layout

```text
zkinsure/
|-- circuits/claim/              Noir claim circuit and generated proof artifacts
|-- contracts/insurance/         Soroban insurance contract and contract tests
|-- evidence/                    Local, mutation, testnet, and dashboard evidence
|-- oracle/                      Deterministic oracle event and signature helpers
|-- scripts/                     Proof fixture, tests, and testnet helper scripts
|-- tests/mutation/              Public-input, replay, and stale-state checks
|-- web/                         Static evidence dashboard generator
|-- TESTNET_DEPLOYMENT.md        Deployment log and readback summary
`-- README.md
```

## WSL-First Setup

WSL Ubuntu is the canonical environment for Noir, Barretenberg, Rust, Soroban, and Stellar CLI.

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev curl git jq unzip
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustup target add wasm32v1-none
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g corepack
corepack enable
cargo install --locked stellar-cli
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
cd /mnt/d/dorahack/stellar/zkinsure
```

Install project dependencies from the project root:

```bash
npm install
```

The npm Noir scripts are Windows convenience wrappers that enter WSL and pin Nargo to `1.0.0-beta.9` before running. This avoids breakage when another WSL job changes the global Nargo version.

## Local Verification

Run the proof fixture:

```bash
npm run proof:fixture
```

Run Noir checks and tests from Windows PowerShell:

```bash
npm run nargo:check
npm run nargo:test
```

From inside WSL, use the underlying commands:

```bash
~/.nargo/bin/nargo --version | grep -q '1.0.0-beta.9' || ~/.nargo/bin/noirup -v 1.0.0-beta.9
~/.nargo/bin/nargo check --program-dir circuits/claim
~/.nargo/bin/nargo test --program-dir circuits/claim
```

Run JavaScript and mutation tests:

```bash
npm test
```

Run Soroban contract tests:

```bash
wsl.exe -d Ubuntu -- bash -lc \
  'cd /mnt/d/dorahack/stellar/zkinsure && cargo test --manifest-path contracts/insurance/Cargo.toml'
```

Build the contract WASM:

```bash
wsl.exe -d Ubuntu -- bash -lc \
  'cd /mnt/d/dorahack/stellar/zkinsure && cargo build --manifest-path contracts/insurance/Cargo.toml --target wasm32v1-none --release'
```

Build the dashboard from live testnet reads:

```bash
wsl.exe -d Ubuntu -- bash -lc \
  'export PATH="$PATH:$HOME/.cargo/bin"; cd /mnt/d/dorahack/stellar/zkinsure && npm run web:build'
```

Expected verification coverage:

- valid proof-backed payout path;
- below-threshold circuit rejection;
- wrong policy id;
- wrong event commitment;
- wrong nullifier;
- wrong oracle signature;
- wrong payout recipient;
- wrong verifier domain;
- mutated proof;
- double-claim replay;
- expired policy;
- missing oracle key;
- stale oracle key.

The latest recorded results are:

- Noir: `7` passed, `0` failed;
- Soroban: `15` passed, `0` failed;
- Node tests: `3` passed, `0` failed;
- Vitest mutation tests: `4` passed, `0` failed.

## Testnet Reproduction Notes

The current deployment is already recorded in `TESTNET_DEPLOYMENT.md`. Re-running deployment scripts will create new testnet transactions and consume testnet XLM from the configured identity.

The current helper script is:

```bash
scripts/testnet_deploy_flow.sh
```

It expects a funded testnet identity available to Stellar CLI and reads the proof artifacts from `artifacts/proof_blob.bin` and `artifacts/public_inputs.bin`. It does not print private keys.

Use only throwaway testnet identities. Do not use mainnet, real funds, private keys in chat, or committed secrets.

## Dashboard Deployment

The public dashboard is a static Vercel deployment of `web/dist`.

```bash
cd D:\dorahack\stellar\zkinsure\web\dist
vercel deploy --prod --yes
vercel alias set <deployment-url> lumensure.vercel.app
```

Current deployment:

- URL: <https://lumensure.vercel.app>
- backing deployment: <https://dist-3ym8kdewa-maixuancanh1111-9074s-projects.vercel.app>
- deployment id: `dpl_76FH2os8D7wybx7ruGPdVLGfe1in`
- status: `READY`

## Competitive Position

Compared with proof-only or UI-only insurance demos, LumenSure emphasizes:

- oracle-signed eligibility rather than a self-reported claim;
- nullifier replay protection across the claim lifecycle;
- contract-side public-input reconstruction;
- public Stellar payout evidence;
- compact evidence files that connect proof artifacts, verifier state, transaction hashes, and final policy state.

## Limitations

- The oracle is a deterministic local fixture. A production deployment would need an independently operated oracle, key management, monitoring, and rotation policy.
- The deployed contract demonstrates one asset and one insurance product on Stellar testnet.
- The proof currently binds a fixed payout-recipient field and verifier-domain field used by the fixture.
- The project is not audited and should not be used with mainnet assets or real insurance obligations.
- Public dashboard data is a static snapshot generated from testnet reads; rebuilding it refreshes the displayed state.
