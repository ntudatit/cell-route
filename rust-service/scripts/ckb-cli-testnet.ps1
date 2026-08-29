$env:API_URL = if ($env:CKB_RPC_URL) { $env:CKB_RPC_URL } else { "https://testnet.ckb.dev" }

Write-Host "CKB CLI RPC: $env:API_URL"
ckb-cli rpc get_tip_block_number
