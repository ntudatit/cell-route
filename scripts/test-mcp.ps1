$body = @{
  jsonrpc = "2.0"
  id = 1
  method = "tools/list"
  params = @{}
} | ConvertTo-Json -Depth 8

$headers = @{ "Content-Type" = "application/json" }
if ($env:MCP_API_KEY) { $headers["x-api-key"] = $env:MCP_API_KEY }
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/mcp" -Headers $headers -Body $body | ConvertTo-Json -Depth 12
