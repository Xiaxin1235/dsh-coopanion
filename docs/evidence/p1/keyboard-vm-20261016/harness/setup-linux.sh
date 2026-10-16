set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
sudo -n apt-get update
sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends xserver-xorg-core xserver-xorg-input-libinput xserver-xorg-video-fbdev xserver-xorg-video-vesa xinit openbox x11-utils fonts-dejavu-core python3 libxi6 libxtst6 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2t64 libxkbcommon0 libdrm2 libgtk-3-0t64 libxshmfence1 libgl1
mkdir -p "$HOME/coop-keyboard/toolchain"
cd "$HOME/coop-keyboard/toolchain"
curl --fail --location --retry 2 --max-time 180 https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz -o node.tar.xz
curl --fail --location --retry 2 --max-time 60 https://nodejs.org/dist/v24.21.0/SHASUMS256.txt -o SHASUMS256.txt
python3 - <<'PY'
from pathlib import Path
import hashlib
row=next(row for row in Path('SHASUMS256.txt').read_text().splitlines() if row.endswith('  node-v24.21.0-linux-x64.tar.xz'))
assert hashlib.sha256(Path('node.tar.xz').read_bytes()).hexdigest()==row.split()[0]
print('Pinned Node download checksum verified')
PY
tar -xf node.tar.xz
export PATH="$HOME/coop-keyboard/toolchain/node-v24.21.0-linux-x64/bin:$PATH"
export npm_config_cache="$HOME/coop-keyboard/npm-cache"
npm install --prefix "$HOME/coop-keyboard/toolchain/npm" --ignore-scripts --no-audit --no-fund npm@11.19.1
node --version
node "$HOME/coop-keyboard/toolchain/npm/node_modules/npm/bin/npm-cli.js" --version
