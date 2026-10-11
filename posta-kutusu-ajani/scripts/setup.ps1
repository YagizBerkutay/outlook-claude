. (Join-Path $PSScriptRoot 'common.ps1')
try {
    Write-Host 'Windows kişisel Outlook asistanı kurulumu' -ForegroundColor Green
    Write-Host 'Eksikse Node.js LTS, Git ve resmî Claude Code kurulacak.'
    Write-Host 'Bu kullanıcı için localhost HTTPS sertifikası oluşturulup güvenilir sertifikalara eklenecek.'
    function Ensure-Package([string]$Executable, [string]$Package) {
        $result = Find-TaskExecutable $Executable
        if ($result) { return $result }
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) { throw "winget bulunamadı. Rehberdeki elle kurulum adımlarını izleyin: $Package" }
        Write-Host "Kuruluyor: $Package"
        & winget.exe install --id $Package --exact --source winget --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) { throw "$Package kurulumu tamamlanmadı. Rehberdeki elle kurulumu deneyin." }
        $result = Find-TaskExecutable $Executable
        if (-not $result) { throw "$Executable henüz bulunamadı. Bu pencereyi kapatıp 1-KURULUM.cmd dosyasını tekrar çalıştırın." }
        return $result
    }
    $nodeExecutable = Ensure-Package 'node' 'OpenJS.NodeJS.LTS'
    $nodeVersion = & $nodeExecutable --version
    if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) { throw 'Node.js 22 veya üstü gerekli. Node.js LTS sürümüne güncelleyin.' }
    $gitExecutable = Ensure-Package 'git' 'Git.Git'
    $claudeExecutable = Ensure-Package 'claude' 'Anthropic.ClaudeCode'
    Write-Host 'Claude Code sürümü:'
    & $claudeExecutable --version
    if ($LASTEXITCODE -ne 0) { throw 'Claude Code çalıştırılamadı. Git Bash ve Claude Code kurulumunu kontrol edin.' }

    $claudeVersionText = & $claudeExecutable --version
    if ($claudeVersionText -notmatch '(\d+\.\d+\.\d+)' -or [version]$Matches[1] -lt [version]'2.1.248') { throw 'Bu ajan için Claude Code 2.1.248 veya üstü gerekli. Claude Code uygulamasını güncelleyin.' }
    New-Item -ItemType Directory -Path $LocalData -Force | Out-Null
    $taskSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    & icacls.exe $LocalData /inheritance:r /grant:r "*${taskSid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Yerel dosya izinleri ayarlanamadı.' }
    $pfxFile = Join-Path $LocalData 'localhost.pfx'
    $existing = $null
    $reuse = $false
    if ((Test-Path -LiteralPath $ConfigPath) -and (Test-Path -LiteralPath $pfxFile)) {
        $existing = Read-TaskConfig
        $existingCert = Get-Item -LiteralPath "Cert:\CurrentUser\My\$($existing.certificateThumbprint)" -ErrorAction SilentlyContinue
        $reuse = $existingCert -and ($existingCert.NotAfter -gt (Get-Date).AddDays(14))
    }
    if ($reuse) {
        $certificate = $existingCert
        $pfxPassword = $existing.pfxPassword
    } else {
        $certificate = New-SelfSignedCertificate -DnsName 'localhost' -CertStoreLocation 'Cert:\CurrentUser\My' -FriendlyName 'Personal Claude Outlook Agent HTTPS' -KeyExportPolicy Exportable -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(1)
        $randomBytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($randomBytes)
        $rng.Dispose()
        $pfxPassword = [Convert]::ToBase64String($randomBytes)
        $securePassword = ConvertTo-SecureString -String $pfxPassword -AsPlainText -Force
        Export-PfxCertificate -Cert $certificate -FilePath $pfxFile -Password $securePassword | Out-Null
    }
    $certFile = Join-Path $LocalData 'localhost.cer'
    Export-Certificate -Cert $certificate -FilePath $certFile -Force | Out-Null
    $trustedCertificate = Import-Certificate -FilePath $certFile -CertStoreLocation 'Cert:\CurrentUser\Root'
    $trustedCertificate.FriendlyName = 'Personal Claude Outlook Agent HTTPS'
    @{ nodeExecutable = $nodeExecutable; claudeExecutable = $claudeExecutable; pfxPassword = $pfxPassword; certificateThumbprint = $certificate.Thumbprint } | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
    Write-Host ''
    Write-Host 'Kurulum tamamlandı.' -ForegroundColor Green
    Write-Host '1. 2-CLAUDE-GIRIS.cmd ile abonelik hesabına giriş yapın.'
    Write-Host '2. 3-BASLAT.cmd dosyasını çalıştırıp açık bırakın.'
    Write-Host '3. Klasik Outlook açıkken https://localhost:3447 adresini açın. Eklenti isteğe bağlıdır.'
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
