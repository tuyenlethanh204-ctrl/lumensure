# LumenSure Demo Script

1. Show policy `1`, threshold `180`, and the public oracle commitment on the evidence dashboard.
2. Explain that value, timestamp, nonce, and EdDSA signature remain private.
3. Run `npm run proof:fixture` and point out native UltraHonk verification plus the exported proof/VK hashes.
4. Run `cargo test --manifest-path contracts/insurance/Cargo.toml` in WSL and show the accepted payout test.
5. Show rejection tests for mutated public inputs, stale oracle key, expired policy, and replay.
6. Open `evidence/auditor-receipt.json`, then show the recorded testnet contract, payout transaction, paid policy, and consumed nullifier.

The testnet segment uses the existing deployment evidence. The demo does not create credentials, request funding, or redeploy.
