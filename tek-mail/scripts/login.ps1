. (Join-Path $PSScriptRoot 'common.ps1')
try {
    $config = Read-TaskConfig
    Clear-TaskProviderEnvironment
    Write-Host 'Claude Code kendi tarayıcı giriş ekranını açacak. Pro/Max aboneliğiniz olan hesabı kullanın.'
    Write-Host 'API/Console hesabı seçmeyin. Şifre veya oturum anahtarını bu pakete yazmayın.'
    & $config.claudeExecutable auth login
    if ($LASTEXITCODE -ne 0) { throw 'Giriş tamamlanmadı. Tekrar deneyin.' }
    & $config.nodeExecutable (Join-Path $TaskRoot 'scripts\diagnose.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Abonelik oturumu doğrulanamadı. Rehberdeki sorun giderme bölümüne bakın.' }
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
