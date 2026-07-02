#!/usr/bin/env bash
export PATH="$PATH:$HOME/.cargo/bin"
stellar keys generate --network testnet deployer || true
