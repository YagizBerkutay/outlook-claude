. (Join-Path $PSScriptRoot 'common.ps1')
try {
    $config = Read-TaskConfig
    Clear-TaskProviderEnvironment
    Write-Host 'Claude Code kendi tarayıcı giriş ekranını açacak. Pro/Max aboneliğiniz olan hesabı kullanın.'
    Write-Host 'API/Console hesabı seçmeyin. Şifre veya oturum anahtarını bu pakete yazmayın.'
    & $config.claudeExecutable auth login
    if ($LASTEXITCODE -ne 0) { throw 'Giriş tamamlanmadı. Tekrar deneyin.' }
    & $config.claudeExecutable auth status
    if ($LASTEXITCODE -ne 0) { throw 'Claude oturumu doğrulanamadı. 4-TANI.cmd dosyasını kullanın.' }
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
