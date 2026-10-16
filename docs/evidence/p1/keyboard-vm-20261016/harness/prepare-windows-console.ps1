$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'COOP-WIN-TEST') { throw 'Unexpected guest' }
$root='C:\coop-keyboard'
if (-not (Test-Path "$root\candidate\package\dist\build-info.json")) { throw 'Candidate not installed' }
$build=Get-Content -Raw "$root\candidate\package\dist\build-info.json" | ConvertFrom-Json
if ($build.commit -ne '555503ef54e1375b084a6bc34d9472e9726658be' -or $build.dirty -ne $false) { throw 'Candidate identity differs' }
$batch=@'
@echo off
set "PATH=C:\coop-keyboard\toolchain\node-v24.21.0-win-x64;%PATH%"
set "DSH_NPC_PACKAGE_ROOT=C:\coop-keyboard\candidate\package"
cd /d C:\coop-keyboard
node vm-npc-probe.mjs candidate\package vm-results > vm-console.log 2>&1
set "COOP_PROBE_RESULT=%ERRORLEVEL%"
node candidate\package\tests\keyboard-activity-native.mjs > native-keyboard.log 2>&1
echo finished> complete.marker
exit /b %COOP_PROBE_RESULT%
'@
[IO.File]::WriteAllText("$root\run-probe.cmd",$batch,[Text.Encoding]::ASCII)
$cleanup=@'
$ErrorActionPreference='Stop'
$path='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
Remove-ItemProperty $path -Name DefaultPassword -ErrorAction SilentlyContinue
Set-ItemProperty $path -Name AutoAdminLogon -Value '0'
$cleared=((Get-Item $path).GetValueNames() -notcontains 'DefaultPassword')
[pscustomobject]@{TemporaryAutoLogonDisabled=$true;TemporaryPasswordRemoved=$cleared} | ConvertTo-Json -Compress | Set-Content 'C:\coop-keyboard\autologin-cleanup.json'
'@
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cleanup))
$action=New-ScheduledTaskAction -Execute "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument "-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand $encoded"
$trigger=New-ScheduledTaskTrigger -AtLogOn -User "$env:COMPUTERNAME\devops"
$principal=New-ScheduledTaskPrincipal -UserId SYSTEM -LogonType ServiceAccount -RunLevel Highest
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -StartWhenAvailable
Register-ScheduledTask -TaskName CoopKeyboardCleanup -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
$probeAction=New-ScheduledTaskAction -Execute "$env:WINDIR\System32\cmd.exe" -Argument '/d /c C:\coop-keyboard\run-probe.cmd'
$probePrincipal=New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\devops" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName CoopKeyboardProbe -Action $probeAction -Principal $probePrincipal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5)) -Force | Out-Null
$sid=(Get-LocalUser devops).SID.Value
& icacls.exe $root /grant ('*'+$sid+':(OI)(CI)M') /Q | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot grant probe user access to its test directory' }
$bytes=New-Object byte[] 32
$rng=[Security.Cryptography.RandomNumberGenerator]::Create();$rng.GetBytes($bytes);$rng.Dispose()
$password=[Convert]::ToBase64String($bytes)+'aA1!'
Set-LocalUser -Name devops -Password (ConvertTo-SecureString $password -AsPlainText -Force)
$path='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
New-ItemProperty $path -Name DefaultUserName -Value devops -PropertyType String -Force | Out-Null
New-ItemProperty $path -Name DefaultDomainName -Value $env:COMPUTERNAME -PropertyType String -Force | Out-Null
New-ItemProperty $path -Name DefaultPassword -Value $password -PropertyType String -Force | Out-Null
New-ItemProperty $path -Name AutoAdminLogon -Value '1' -PropertyType String -Force | Out-Null
New-ItemProperty $path -Name AutoLogonCount -Value 1 -PropertyType DWord -Force | Out-Null
Remove-Variable password,bytes
[pscustomobject]@{Guest=$env:COMPUTERNAME;OneBootConsoleLogonConfigured=$true;CleanupTaskInstalled=$true;ProbeUsesInteractiveLimitedToken=$true} | ConvertTo-Json -Compress
shutdown.exe /r /t 3
