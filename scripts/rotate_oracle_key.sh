#!/usr/bin/env bash
set -euo pipefail
export PATH="$PATH:$HOME/.cargo/bin"

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <CONTRACT_ID> <ORACLE_PUBKEY_X_HEX> <ORACLE_PUBKEY_Y_HEX>"
    exit 1
fi

POOL_ID=$1
PUBKEY_X=$2
PUBKEY_Y=$3

echo "Rotating oracle key for contract $POOL_ID..."

stellar contract invoke \
  --id "$POOL_ID" \
  --source deployer \
  --network testnet \
  -- set_oracle_key --oracle_public_key_x "$PUBKEY_X" --oracle_public_key_y "$PUBKEY_Y"

echo "Oracle key rotation successful."
