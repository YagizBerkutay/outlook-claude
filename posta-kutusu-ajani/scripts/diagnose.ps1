. (Join-Path $PSScriptRoot 'common.ps1')
try {
    $config = Read-TaskConfig
    Clear-TaskProviderEnvironment
    & $config.nodeExecutable (Join-Path $TaskRoot 'scripts\diagnose.mjs')
    exit $LASTEXITCODE
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
