$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$root='C:\coop-keyboard'
$node="$root\toolchain\node-v24.21.0-win-x64\node.exe"
$npm="$root\toolchain\npm\node_modules\npm\bin\npm-cli.js"
$env:PATH="$root\toolchain\node-v24.21.0-win-x64;$env:PATH"
$env:npm_config_cache="$root\npm-cache"
Set-Location "$root\candidate\package"
& $node node_modules/vitest/vitest.mjs run tests/figures.test.ts
if ($LASTEXITCODE -ne 0) { throw 'Unchanged targeted retry failed' }
& $node $npm test
if ($LASTEXITCODE -ne 0) { throw 'Full Windows retry failed' }
Remove-Item "$root\candidate\package\dist" -Recurse -Force
& tar.exe -xzf "$root\candidate.tgz" -C "$root\candidate" package/dist package/web/markdown-runtime.js
if ($LASTEXITCODE -ne 0) { throw 'Original package restoration failed' }
Get-Content -Raw "$root\candidate\package\dist\build-info.json"
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture | ConvertTo-Json -Compress
