. (Join-Path $PSScriptRoot 'common.ps1')
try {
    $config = Read-TaskConfig
    Clear-TaskProviderEnvironment
    Set-Location -LiteralPath $TaskRoot
    & $config.nodeExecutable (Join-Path $TaskRoot 'server.mjs')
    exit $LASTEXITCODE
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
