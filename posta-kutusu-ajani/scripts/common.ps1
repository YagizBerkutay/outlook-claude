$ErrorActionPreference = 'Stop'
$TaskRoot = Split-Path -Parent $PSScriptRoot
$LocalData = Join-Path $TaskRoot '.local'
$ConfigPath = Join-Path $LocalData 'config.json'

function Refresh-TaskPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath;$env:USERPROFILE\.local\bin;$env:LOCALAPPDATA\Microsoft\WinGet\Links"
}

function Find-TaskExecutable([string]$Name) {
    Refresh-TaskPath
    $found = Get-Command "$Name.exe" -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.Source }
    return $null
}

function Read-TaskConfig {
    if (-not (Test-Path -LiteralPath $ConfigPath)) { throw 'Önce 1-KURULUM.cmd dosyasını çalıştırın.' }
    return Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Clear-TaskProviderEnvironment {
    # Only this process and its children are affected. User/system settings are not edited.
    Get-ChildItem Env: | Where-Object { $_.Name -match '^(ANTHROPIC_|CLAUDE_CODE_(USE_|OAUTH_TOKEN|API_KEY|SUBAGENT_MODEL|BASE_URL)|AWS_|GOOGLE_|AZURE_)' } | ForEach-Object { Remove-Item -LiteralPath "Env:\$($_.Name)" }
    Remove-Item -LiteralPath Env:\CLAUDECODE -ErrorAction SilentlyContinue
}
