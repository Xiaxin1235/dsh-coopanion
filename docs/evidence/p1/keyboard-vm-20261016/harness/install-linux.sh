set -euo pipefail
cd "$HOME/coop-keyboard"
echo 'f459a7c8715bf892d9b0649521bc26a9d29befddc09950d89319d43e0fc48d34  candidate.tgz' | sha256sum -c
mkdir -p candidate
tar -xzf candidate.tgz -C candidate
cd candidate/package
export PATH="$HOME/coop-keyboard/toolchain/node-v24.21.0-linux-x64/bin:$PATH"
export npm_config_cache="$HOME/coop-keyboard/npm-cache"
export ELECTRON_CACHE="$HOME/coop-keyboard/electron-cache"
export PLAYWRIGHT_BROWSERS_PATH="$HOME/coop-keyboard/browsers"
node "$HOME/coop-keyboard/toolchain/npm/node_modules/npm/bin/npm-cli.js" ci --ignore-scripts --no-audit --no-fund
node "$HOME/coop-keyboard/toolchain/npm/node_modules/npm/bin/npm-cli.js" run setup:electron
sudo -n sh -c 'nohup Xorg :0 -ac -nolisten tcp -noreset vt7 > /tmp/coop-xorg.log 2>&1 & echo $! > /tmp/coop-xorg.pid'
for i in $(seq 1 50); do if DISPLAY=:0 xdpyinfo >/dev/null 2>&1; then break; fi; sleep .2; done
DISPLAY=:0 xdpyinfo >/dev/null
DISPLAY=:0 nohup openbox > "$HOME/coop-keyboard/openbox.log" 2>&1 &
printf '%s\n' 'Private real Xorg display :0 ready'
