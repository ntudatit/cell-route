#!/usr/bin/env bash
set -euo pipefail

export API_URL="${CKB_RPC_URL:-https://testnet.ckb.dev}"

echo "CKB CLI RPC: $API_URL"
ckb-cli rpc get_tip_block_number
