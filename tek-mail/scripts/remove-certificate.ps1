. (Join-Path $PSScriptRoot 'common.ps1')
try {
    $config = Read-TaskConfig
    $thumbprint = $config.certificateThumbprint
    if ($thumbprint -notmatch '^[A-Fa-f0-9]{40}$') { throw 'Sertifika kimliği geçersiz.' }
    foreach ($store in @('My', 'Root')) {
        $certPath = "Cert:\CurrentUser\$store\$thumbprint"
        $cert = Get-Item -LiteralPath $certPath -ErrorAction SilentlyContinue
        if ($cert -and $cert.FriendlyName -eq 'Personal Local Mail Assistant HTTPS') { Remove-Item -LiteralPath $certPath }
    }
    Write-Host 'Paketin localhost sertifikası kaldırıldı. Outlook uygulamasından eklentiyi de kaldırabilirsiniz.'
    Write-Host 'Klasörü elle silebilirsiniz. Node.js, Git ve Claude Code kaldırılmadı.'
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
