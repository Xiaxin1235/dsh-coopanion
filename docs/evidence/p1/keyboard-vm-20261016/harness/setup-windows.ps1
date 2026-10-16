$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$root='C:\coop-keyboard'
if ((Get-FileHash "$root\candidate.tgz" -Algorithm SHA256).Hash.ToLower() -ne 'f459a7c8715bf892d9b0649521bc26a9d29befddc09950d89319d43e0fc48d34') { throw 'Candidate checksum mismatch' }
if ((Get-FileHash "$root\node-win.zip" -Algorithm SHA256).Hash.ToLower() -ne '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541') { throw 'Node checksum mismatch' }
New-Item -ItemType Directory -Force "$root\toolchain","$root\candidate" | Out-Null
Expand-Archive -Path "$root\node-win.zip" -DestinationPath "$root\toolchain" -Force
& tar.exe -xzf "$root\candidate.tgz" -C "$root\candidate"
if ($LASTEXITCODE -ne 0) { throw 'Candidate extraction failed' }
$node="$root\toolchain\node-v24.21.0-win-x64\node.exe"
$env:PATH="$root\toolchain\node-v24.21.0-win-x64;$env:PATH"
$env:npm_config_cache="$root\npm-cache"
$env:ELECTRON_CACHE="$root\electron-cache"
& $node "$root\toolchain\node-v24.21.0-win-x64\node_modules\npm\bin\npm-cli.js" install --prefix "$root\toolchain\npm" --ignore-scripts --no-audit --no-fund npm@11.19.1
if ($LASTEXITCODE -ne 0) { throw 'Pinned npm setup failed' }
$npm="$root\toolchain\npm\node_modules\npm\bin\npm-cli.js"
& $node --version
& $node $npm --version
Set-Location "$root\candidate\package"
& $node $npm ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
& $node $npm run setup:electron
if ($LASTEXITCODE -ne 0) { throw 'Electron setup failed' }
& $node $npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Windows typecheck failed' }
& $node $npm test
if ($LASTEXITCODE -ne 0) { throw 'Windows tests failed' }
# Node checks rebuild dist. Restore the exact original package outputs before native acceptance.
Remove-Item "$root\candidate\package\dist" -Recurse -Force
& tar.exe -xzf "$root\candidate.tgz" -C "$root\candidate" package/dist package/web/markdown-runtime.js
if ($LASTEXITCODE -ne 0) { throw 'Original package output restoration failed' }
Get-Content -Raw "$root\candidate\package\dist\build-info.json"
[pscustomobject]@{ComputerName=$env:COMPUTERNAME;OS=(Get-CimInstance Win32_OperatingSystem).Caption;Version=(Get-CimInstance Win32_OperatingSystem).Version;ConsoleUser=(Get-CimInstance Win32_ComputerSystem).UserName;Admin=$([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)} | ConvertTo-Json -Compress
