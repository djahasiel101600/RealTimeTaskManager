Param(
  [string]$SchemaUrl = "http://localhost:8001/api/schema/",
  [string]$OutFile = "frontend/src/types/openapi.ts"
)

Write-Host "Fetching OpenAPI schema from $SchemaUrl"

$schemaPath = Join-Path $env:TEMP "openapi_schema.json"
Invoke-WebRequest -Uri $SchemaUrl -OutFile $schemaPath -UseBasicParsing

Write-Host "Generating TypeScript types to $OutFile using npx openapi-typescript"

# Use npx to avoid global install requirement
$npx = "npx"
$cmd = "$npx openapi-typescript `"$schemaPath`" -o `"$OutFile`" --silent"
Write-Host $cmd

Invoke-Expression $cmd

Write-Host "Done. Review $OutFile and commit if desired."
