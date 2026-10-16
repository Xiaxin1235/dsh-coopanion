$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$root='C:\coop-keyboard'
$consoleUser=(Get-CimInstance Win32_ComputerSystem).UserName
if ($consoleUser -ne "$env:COMPUTERNAME\devops") { throw 'Expected dedicated console user' }
if (-not (Test-Path "$root\autologin-cleanup.json")) { throw 'Auto-logon cleanup not completed' }
$cleanup=Get-Content -Raw "$root\autologin-cleanup.json" | ConvertFrom-Json
if (-not $cleanup.TemporaryPasswordRemoved) { throw 'Temporary credential not cleared' }
Start-ScheduledTask -TaskName CoopKeyboardProbe
$started=Get-Date
$last=''
while (((Get-Date)-$started).TotalSeconds -lt 180) {
 if (Test-Path "$root\vm-results\phase.json") {
  $phase=(Get-Content -Raw "$root\vm-results\phase.json" | ConvertFrom-Json).phase
  if ($phase -ne $last) { [Console]::Out.WriteLine('PHASE '+$phase);[Console]::Out.Flush();$last=$phase }
 }
 if (Test-Path "$root\complete.marker") { Get-Content -Raw "$root\vm-results\result.json"; exit 0 }
 Start-Sleep -Milliseconds 200
}
throw 'Console probe timed out'
