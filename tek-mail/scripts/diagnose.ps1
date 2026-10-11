. (Join-Path $PSScriptRoot 'common.ps1')
try {
    $config = Read-TaskConfig
    Clear-TaskProviderEnvironment
    Write-Host 'Node.js:'
    & $config.nodeExecutable --version
    Write-Host 'Claude Code:'
    & $config.claudeExecutable --version
    $certificate = Get-Item -LiteralPath "Cert:\CurrentUser\Root\$($config.certificateThumbprint)" -ErrorAction SilentlyContinue
    if ($certificate) { Write-Host "localhost sertifikası: $($certificate.NotAfter.ToString('yyyy-MM-dd')) tarihine kadar geçerli" }
    else { Write-Host 'localhost sertifikası güvenilir depoda bulunamadı. 1-KURULUM.cmd dosyasını tekrar çalıştırın.' }
    & $config.nodeExecutable (Join-Path $TaskRoot 'scripts\diagnose.mjs')
    $authExit = $LASTEXITCODE
    try {
        $page = Invoke-WebRequest -Uri 'https://localhost:3443/' -UseBasicParsing -TimeoutSec 5
        Write-Host "Yerel sunucu: HTTP $($page.StatusCode)"
    } catch { Write-Host 'Yerel sunucuya erişilemiyor. 3-BASLAT.cmd açık mı? Sertifika uyarısı var mı?' }
    exit $authExit
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
