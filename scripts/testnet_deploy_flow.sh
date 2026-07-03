#!/usr/bin/env bash
set -euo pipefail

export PATH="$PATH:$HOME/.cargo/bin"

CONTRACT_ID="${CONTRACT_ID:-CBMRHKVESDGT54LRSHVFQ2F7OS6O4VKZ2665RAT4BGVNKS3BHZK6TIYW}"
SOURCE="${SOURCE:-deployer}"
NETWORK="${NETWORK:-testnet}"
ADMIN="${ADMIN:-$(stellar keys public-key "$SOURCE")}"
TOKEN="${TOKEN:-$(stellar contract id asset --asset native --network "$NETWORK")}"

COMMITMENT="$(xxd -p -c 256 -l 32 artifacts/public_inputs.bin)"
ORACLE_KEY_X="$(xxd -p -c 256 -s 32 -l 32 artifacts/public_inputs.bin)"
ORACLE_KEY_Y="$(xxd -p -c 256 -s 64 -l 32 artifacts/public_inputs.bin)"
NULLIFIER="$(xxd -p -c 256 -s 96 -l 32 artifacts/public_inputs.bin)"
PAYOUT_RECIPIENT="$(xxd -p -c 256 -s 192 -l 32 artifacts/public_inputs.bin)"
VERIFIER_DOMAIN="$(xxd -p -c 256 -s 224 -l 32 artifacts/public_inputs.bin)"

invoke() {
  stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    --auto-sign \
    "$@"
}

token_invoke() {
  stellar contract invoke \
    --id "$TOKEN" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    --auto-sign \
    "$@"
}

echo "contract_id=$CONTRACT_ID"
echo "admin=$ADMIN"
echo "token=$TOKEN"
echo "oracle_key_x=$ORACLE_KEY_X"
echo "oracle_key_y=$ORACLE_KEY_Y"
echo "commitment=$COMMITMENT"
echo "nullifier=$NULLIFIER"
echo "payout_recipient=$PAYOUT_RECIPIENT"
echo "verifier_domain=$VERIFIER_DOMAIN"

if [[ "${RESUME_AFTER_POLICY:-0}" != "1" ]]; then
  echo ":: create_product"
  invoke -- create_product --premium 10 --payout 1000 --threshold 180

  echo ":: buy_policy_0"
  invoke -- buy_policy --holder "$ADMIN" --product_id 0 --duration_seconds 3600

  echo ":: buy_policy_1"
  invoke -- buy_policy --holder "$ADMIN" --product_id 0 --duration_seconds 3600
fi

echo ":: publish_event"
invoke -- publish_event --policy_id 1 --oracle_commitment "$COMMITMENT"

echo ":: reserve_transfer"
token_invoke -- transfer --from "$ADMIN" --to "$CONTRACT_ID" --amount 1000

echo ":: claim"
invoke -- claim \
  --policy_id 1 \
  --proof_blob-file-path artifacts/proof_blob.bin \
  --nullifier "$NULLIFIER" \
  --payout_recipient "$PAYOUT_RECIPIENT" \
  --verifier_domain "$VERIFIER_DOMAIN"

echo ":: readbacks"
invoke --send no -- get_product --product_id 0
invoke --send no -- get_policy --policy_id 1
invoke --send no -- get_event --policy_id 1
invoke --send no -- nullifier_used --nullifier "$NULLIFIER"
token_invoke --send no -- balance --id "$CONTRACT_ID"
