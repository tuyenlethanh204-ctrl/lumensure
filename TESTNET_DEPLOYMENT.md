# LumenSure Testnet Deployment Status

Current status on 2026-07-02: **Stellar testnet verified for the current EdDSA/Poseidon + oracle-key-registry build**.

## Network and deployer

- Network: Stellar testnet (`Test SDF Network ; September 2015`)
- CLI: `stellar 27.0.0`
- Deployer identity: `alice`
- Deployer public key: `GARSBZTUP3DS4N3HWVXS47AK2RS5T2MKBC3CISFKQD4D26DVLZUD7MZ7`
- Native token contract: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Insurance contract: `CBQ3WXWBRGDRUNYFMPYCFKSCL4KZOTAA3HDQHU7XVGEFWHXIHEQ3NQ53`
- Uploaded WASM hash: `ab620c01803bb5535a5f56ecad2a3a48cbefcf1e5fc55820cca10e8e43f357d3`

## Deployment transactions

1. Upload current insurance WASM:
   - Tx: `2565bf8c2af3e4efa557db2cc94400849cea2f8a49e7d3d1e35c9367e1ae3075`
   - Explorer: <https://stellar.expert/explorer/testnet/tx/2565bf8c2af3e4efa557db2cc94400849cea2f8a49e7d3d1e35c9367e1ae3075>
2. Deploy insurance contract:
   - Tx: `798dfd3bb6542a7643eee56e6ac4f5fdc98785ec947c1f717d9e43d0e8719858`
   - Explorer: <https://stellar.expert/explorer/testnet/tx/798dfd3bb6542a7643eee56e6ac4f5fdc98785ec947c1f717d9e43d0e8719858>
   - Contract: <https://lab.stellar.org/r/testnet/contract/CBQ3WXWBRGDRUNYFMPYCFKSCL4KZOTAA3HDQHU7XVGEFWHXIHEQ3NQ53>

## Initialization and oracle-key registry

- `init(admin=alice, token=native SAC)`
  - Tx: `1edebfa04fc9120f8902cfabe13e5410fe2ae00684c44bdd44d3d91dd1919ae7`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/1edebfa04fc9120f8902cfabe13e5410fe2ae00684c44bdd44d3d91dd1919ae7>
- `set_oracle_key(public_key_x, public_key_y)`
  - Tx: `abfd0c1f4ebdb36d7bd9eb002940067b061514ba99c4de98f1d925bc1efece7d`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/abfd0c1f4ebdb36d7bd9eb002940067b061514ba99c4de98f1d925bc1efece7d>
  - `public_key_x`: `16b051f37589e0dcf4ad3c415c090798c10d3095bedeedabfcc709ad787f3507`
  - `public_key_y`: `062800ac9e60839fab9218e5ed9d541f4586e41275f4071816a975895d349a5e`
- Read-back check:
  - `get_oracle_key_x` returned `16b051f37589e0dcf4ad3c415c090798c10d3095bedeedabfcc709ad787f3507`

## Public claim smoke

- `create_product(premium=10, payout=1000, threshold=180)`
  - Returned `product_id=0`
  - Tx: `1a8661bde13a5a5a6499340f8743f7e05ce88aeddb5121c6639aa0ec1ee9d7f6`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/1a8661bde13a5a5a6499340f8743f7e05ce88aeddb5121c6639aa0ec1ee9d7f6>
- First `buy_policy(holder=alice, product_id=0, duration_seconds=3600)`
  - Returned `policy_id=0`
  - Tx: `7f762170fb4642d66b429fc8b7133661651b275f02ac3d4d326b877ba4416602`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/7f762170fb4642d66b429fc8b7133661651b275f02ac3d4d326b877ba4416602>
- Second `buy_policy(holder=alice, product_id=0, duration_seconds=3600)`
  - Returned `policy_id=1`, matching the regenerated proof fixture.
  - Tx: `a4f033a839753ea3f80583af75993876cc997a862b25e207cae53b06b5699fd5`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/a4f033a839753ea3f80583af75993876cc997a862b25e207cae53b06b5699fd5>
- `publish_event(policy_id=1, oracle_commitment=...)`
  - Tx: `90fcb763af8d1108c37b3272f9fd89d9b73781119ffc71f0a36865dfe2d614c8`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/90fcb763af8d1108c37b3272f9fd89d9b73781119ffc71f0a36865dfe2d614c8>
  - Commitment: `1a5ba115182cb8e9f6dfa6cfe7c5fe99b02bd0134829731850006fb540f0feb2`
  - Read-back `get_event(policy_id=1)` returned the same commitment.
- Payout reserve transfer to insurance contract:
  - Tx: `d46c6f5e6ab976405da65af21fd7d7ea53d53a5d93bcb830ca8fbd7442d83f92`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/d46c6f5e6ab976405da65af21fd7d7ea53d53a5d93bcb830ca8fbd7442d83f92>
- `claim(policy_id=1, proof_blob=artifacts/proof_blob.bin, nullifier=...)`
  - Tx: `fec4fae1ee7c4a1c2a41db4dcf91614e521ef0b2c4a806bc154b811ccfd66ffa`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/fec4fae1ee7c4a1c2a41db4dcf91614e521ef0b2c4a806bc154b811ccfd66ffa>
  - Nullifier: `01b0c7c47ce498044496c78ded485186f5bc7c5254a0a77e3abda249f5596758`
  - Event evidence: native token transfer of `1000` from insurance contract to `alice`.

## Post-claim checks

- `nullifier_used(nullifier)` returned `true`.
- Insurance native-token balance returned `20`, matching two premiums of `10` after paying out the `1000` reserve.

## Web demo

- `npm run web:build` renders `web/dist/index.html` from live Stellar testnet reads.
- The generated demo source data is `web/dist/onchain-snapshot.json`.
- On-chain reads include product `0`, policy `1`, oracle event, oracle public key, nullifier status, insurance contract token balance, and deployer token balance.
- The public interface presents only LumenSure policy, proof, oracle, reserve, and on-chain settlement data.
- Public Vercel deployment:
  - URL: <https://lumensure.vercel.app>
  - Backing deployment URL: <https://dist-olfsegf80-maixuancanh1111-9074s-projects.vercel.app>
  - Deployment id: `dpl_F9chTSgrqN4FG2BmtXWHpA6jyBT6`
  - Status: `READY`
  - Alias status: `lumensure.vercel.app` points to `dist-olfsegf80-maixuancanh1111-9074s-projects.vercel.app`.
  - Verified live HTML contains `KHTeka`, `fonts.reown`, `Overview`, `Policy`, `Claim proof`, `Oracle`, `Reserve`, `Evidence`, `View contract`, and `On-chain snapshot`.
  - Verified live HTML no longer contains unrelated Pharos/product-copy strings: `Agent Carnival`, `Rewards`, `Harbor`, `Ecosystem`, `X (Twitter)`, `Connect Wallet`, or `Port</span>`.
  - Verified live `onchain-snapshot.json` contains `paid=true`, `nullifierUsed=true`, and `insuranceBalance=20`.

## Notes

- The native asset contract already existed on testnet, so `stellar contract asset deploy --asset native` returned `Error(Storage, ExistingValue)`. The canonical native SAC id was resolved with `stellar contract id asset --asset native --network testnet`.
- One reserve-transfer attempt timed out after submission and was not reflected in contract balance. Balance was checked before retrying; the successful reserve tx is `d46c6f5e6ab976405da65af21fd7d7ea53d53a5d93bcb830ca8fbd7442d83f92`.
