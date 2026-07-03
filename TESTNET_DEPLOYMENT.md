# LumenSure Testnet Deployment Status

Current status on 2026-07-03: **Stellar testnet verified for the current payout-recipient and verifier-domain bound build**.

## Network and deployer

- Network: Stellar testnet (`Test SDF Network ; September 2015`)
- CLI: `stellar 27.0.0`
- Deployer identity: `deployer`
- Deployer public key: `GB4W3UIOBSERQ45D5KU2L56WN4CZJBOKR7KXUH4QFCW2TACCZJOOBH43`
- Native token contract: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Insurance contract: `CBMRHKVESDGT54LRSHVFQ2F7OS6O4VKZ2665RAT4BGVNKS3BHZK6TIYW`
- Uploaded WASM hash: `1002df92bb57042947bee3e1e66eabbeb9b7275edc4729786878a665e217f306`

## Deployment transactions

1. Upload current insurance WASM:
   - Tx: `3a69561b6c1c9dde9d1096b86d3bbf89a8b288680a9a3804195ebe8aebee8244`
   - Explorer: <https://stellar.expert/explorer/testnet/tx/3a69561b6c1c9dde9d1096b86d3bbf89a8b288680a9a3804195ebe8aebee8244>
2. Deploy insurance contract:
   - Tx: `37f00e437ef58a60d627db40f64631c3907f251828d78dc11dee02fb5d002ee0`
   - Explorer: <https://stellar.expert/explorer/testnet/tx/37f00e437ef58a60d627db40f64631c3907f251828d78dc11dee02fb5d002ee0>
   - Contract: <https://lab.stellar.org/r/testnet/contract/CBMRHKVESDGT54LRSHVFQ2F7OS6O4VKZ2665RAT4BGVNKS3BHZK6TIYW>

## Initialization and oracle-key registry

- `init(admin=deployer, token=native SAC)`
  - Tx: `a1cda63341b1d4430de9981f88cf57fb56f4ed728af8c3e724e64b367ebdb8a3`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/a1cda63341b1d4430de9981f88cf57fb56f4ed728af8c3e724e64b367ebdb8a3>
- `set_oracle_key(public_key_x, public_key_y)`
  - Tx: `21eb35e7d10e551fde9fc9d6a9af9d437b586192846dd525b4f151a9b32c28e2`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/21eb35e7d10e551fde9fc9d6a9af9d437b586192846dd525b4f151a9b32c28e2>
  - `public_key_x`: `16b051f37589e0dcf4ad3c415c090798c10d3095bedeedabfcc709ad787f3507`
  - `public_key_y`: `062800ac9e60839fab9218e5ed9d541f4586e41275f4071816a975895d349a5e`

## Public claim smoke

- `create_product(premium=10, payout=1000, threshold=180)`
  - Returned `product_id=0`
  - Tx: `7a52e7cb376e1ce0e08d654a9feff53ce8d24b16e91878c67088eec17116234f`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/7a52e7cb376e1ce0e08d654a9feff53ce8d24b16e91878c67088eec17116234f>
- First `buy_policy(holder=deployer, product_id=0, duration_seconds=3600)`
  - Returned `policy_id=0`
  - Tx: `b4d80378f8167aa5208cc6343f10255cbe599a476e40dd55a0a45dc64df10137`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/b4d80378f8167aa5208cc6343f10255cbe599a476e40dd55a0a45dc64df10137>
- Second `buy_policy(holder=deployer, product_id=0, duration_seconds=3600)`
  - Returned `policy_id=1`, matching the regenerated proof fixture.
  - Tx: `e0fc2c1b362977877b2917e42186e9c67df2dd2e2ebce104e5bed1c0a507431f`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/e0fc2c1b362977877b2917e42186e9c67df2dd2e2ebce104e5bed1c0a507431f>
- `publish_event(policy_id=1, oracle_commitment=...)`
  - Tx: `10a3e0284fd7f4c5867265bd322de70e68ec2a3d2ad3988e6a45128097cd4ca6`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/10a3e0284fd7f4c5867265bd322de70e68ec2a3d2ad3988e6a45128097cd4ca6>
  - Commitment: `1a5ba115182cb8e9f6dfa6cfe7c5fe99b02bd0134829731850006fb540f0feb2`
- Payout reserve transfer to insurance contract:
  - Tx: `ac667d4e40398846726d56e43bd417e6131ec825beef518e0ad0e4d2f8fdace0`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/ac667d4e40398846726d56e43bd417e6131ec825beef518e0ad0e4d2f8fdace0>
- `claim(policy_id=1, proof_blob=artifacts/proof_blob.bin, nullifier=..., payout_recipient=..., verifier_domain=...)`
  - Tx: `0c9aafdff6461833c099ed93a28d5bc9d92b8ff1835fcd4d05abdc7f8bc5b5b6`
  - Explorer: <https://stellar.expert/explorer/testnet/tx/0c9aafdff6461833c099ed93a28d5bc9d92b8ff1835fcd4d05abdc7f8bc5b5b6>
  - Nullifier: `01b0c7c47ce498044496c78ded485186f5bc7c5254a0a77e3abda249f5596758`
  - Payout recipient field: `00000000000000000000000000000000000000000000000000000000075bcd15`
  - Verifier domain field: `000000000000000000000000000000000000000000000000000000003ade68b1`
  - Event evidence: native token transfer of `1000` from insurance contract to `deployer`.

## Post-claim checks

- `get_product(product_id=0)` returned `active=true`, `premium=10`, `payout=1000`, `threshold=180`.
- `get_policy(policy_id=1)` returned `paid=true`, `active=false`, holder `GB4W3UIOBSERQ45D5KU2L56WN4CZJBOKR7KXUH4QFCW2TACCZJOOBH43`.
- `get_event(policy_id=1)` returned the commitment above.
- `nullifier_used(nullifier)` returned `true`.
- Insurance native-token balance returned `20`, matching two premiums of `10` after paying out the `1000` reserve.

## Web demo

- `npm run web:build` renders `web/dist/index.html` from live Stellar testnet reads.
- The generated demo source data is `web/dist/onchain-snapshot.json`.
- Public Vercel deployment:
  - URL: <https://lumensure.vercel.app>
  - Backing deployment URL: <https://dist-3ym8kdewa-maixuancanh1111-9074s-projects.vercel.app>
  - Deployment id: `dpl_76FH2os8D7wybx7ruGPdVLGfe1in`
  - Status: `READY`
  - Alias status: `lumensure.vercel.app` points to `dist-3ym8kdewa-maixuancanh1111-9074s-projects.vercel.app`.
  - Verified live HTML and `onchain-snapshot.json` contain the current contract, claim transaction, paid state, and no mojibake.

## Notes

- The deployment used the existing local WSL identity `deployer`; no private key was printed or persisted in evidence.
- The raw CLI log is recorded at `evidence/testnet-deploy-2026-07-03.log`.
