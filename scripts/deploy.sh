#!/usr/bin/env bash
set -euo pipefail
export PATH="$PATH:$HOME/.cargo/bin"

echo "Building insurance contract..."
(cd contracts/insurance && stellar contract build)

echo "Deploying to testnet..."
POOL_ID=$(stellar contract deploy \
  --wasm contracts/target/wasm32v1-none/release/insurance.wasm \
  --source deployer \
  --network testnet)

echo "Insurance Pool deployed at: $POOL_ID"

ADMIN=$(stellar keys address deployer)
echo "Initializing pool with admin $ADMIN and balance 1000000..."
stellar contract invoke \
  --id "$POOL_ID" \
  --source deployer \
  --network testnet \
  -- init --admin "$ADMIN" --initial_pool_balance 1000000

echo "Deployment successful."
