$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Run this installation/uninstallation test only on a disposable GitHub Actions runner.' }
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$setup = (Resolve-Path "release-commercial/Terminal-Buddy-Setup-$version-x64.exe").Path
$installDirectory = Join-Path $env:LOCALAPPDATA 'Programs/terminal-buddy'
$profileDirectory = Join-Path $env:APPDATA 'terminal-buddy-subscription'
New-Item -ItemType Directory -Force -Path $profileDirectory | Out-Null
$sentinel = Join-Path $profileDirectory 'installer-test-preserve.txt'
Set-Content -LiteralPath $sentinel -Value 'Preserve existing settings and work'
function Install-And-Check {
    $process = Start-Process -FilePath $setup -ArgumentList @('/S') -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Installer exited $($process.ExitCode)" }
    $entries = Get-ChildItem HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall | Get-ItemProperty | Where-Object { $_.DisplayName -like 'Terminal Buddy Subscription*' }
    if (@($entries).Count -ne 1) { throw 'Expected one Windows uninstall entry' }
    if ($entries.UninstallString -notmatch '^"([^"]+)"') { throw 'Unexpected uninstall command' }
    $script:uninstaller = $Matches[1]
    $script:installDirectory = Split-Path -Parent $uninstaller
    if (!(Test-Path (Join-Path $installDirectory 'Terminal Buddy Subscription.exe'))) { throw 'Installed executable missing' }
    $shell = New-Object -ComObject WScript.Shell
    foreach ($directory in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
        $shortcut = Join-Path $directory 'Terminal Buddy Subscription.lnk'
        if (!(Test-Path -LiteralPath $shortcut)) { throw "Missing shortcut in $directory" }
        if ($shell.CreateShortcut($shortcut).TargetPath -ne (Join-Path $installDirectory 'Terminal Buddy Subscription.exe')) { throw 'Incorrect shortcut target' }
    }
    if (!(Test-Path -LiteralPath $sentinel)) { throw 'Installer removed existing profile' }
}
Install-And-Check
Install-And-Check
$env:BUDDY_EXE = Join-Path $installDirectory 'Terminal Buddy Subscription.exe'
node scripts/verify-subscription-desktop.mjs
if ($LASTEXITCODE -ne 0) { throw 'Installed application smoke test failed' }
$process = Start-Process -FilePath $uninstaller -ArgumentList @('/S', '/currentuser') -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw 'Uninstaller failed' }
for ($attempt=0; $attempt -lt 30 -and (Test-Path $env:BUDDY_EXE); $attempt++) { Start-Sleep -Seconds 1 }
if (Test-Path $env:BUDDY_EXE) { throw 'Uninstaller left the application installed' }
if (!(Test-Path -LiteralPath $sentinel)) { throw 'Uninstaller removed user data' }
Write-Output 'PASS clean install, reinstall, shortcuts, installed app/native PTY, uninstall, profile preservation.'
