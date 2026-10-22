#!/usr/bin/env bash
# Project-local VM control; guest desktop actions never target the host desktop.
set -euo pipefail
vm_project="$(cd "$(dirname "$0")/.." && pwd -P)"
vm_state="$vm_project/.local/macos-vm"
vm_tart="$vm_project/.cache/tools/tart/2.40.1/tart.app/Contents/MacOS/tart"
vm_name="${DSH_MACOS_VM_NAME:-dsh-macos15-test}"
export TART_HOME="$vm_state/tart"
export TART_NO_AUTO_PRUNE=1
if [[ -L "$vm_project/.local" || -L "$vm_state" || -L "$TART_HOME" ]]; then
  printf 'Refusing a symlinked VM storage boundary.\n' >&2
  exit 1
fi
if [[ "$vm_name" != dsh-macos15-base && "$vm_name" != dsh-macos15-test ]]; then
  printf 'Only this project\x27s prepared base and test VM are managed.\n' >&2
  exit 2
fi
if [[ ! -x "$vm_tart" ]]; then
  printf 'Pinned Tart 2.40.1 is missing; see docs/macos-vm-testing.md\n' >&2
  exit 1
fi
case "${1:-status}" in
  status)
    "$vm_tart" list --format json
    df -h "$vm_project"
    ;;
  start)
    vm_free_kib="$(df -Pk "$vm_project" | awk 'NR==2 {print $4}')"
    if [[ "$vm_free_kib" -lt 62914560 ]]; then
      printf 'Less than 60 GiB free on the host; inspect storage before starting.\n' >&2
      exit 1
    fi
    vm_active="$("$vm_tart" list --source local --format json | python3 -c 'import json,sys; print(", ".join(x["Name"] for x in json.load(sys.stdin) if x["Running"]))')"
    if [[ -n "$vm_active" ]]; then
      printf 'A project VM is already running: %s\n' "$vm_active" >&2
      exit 1
    fi
    # Keep the VM alive in this terminal; stop from another terminal or Ctrl-C.
    exec "$vm_tart" run "$vm_name" --no-graphics --no-audio --no-clipboard --no-usb-accessories
    ;;
  stop)
    exec "$vm_tart" stop "$vm_name" --timeout 30
    ;;
  ssh|exec)
    shift
    vm_ip="$("$vm_tart" ip "$vm_name" --wait 60)"
    exec ssh -F /dev/null -i "$vm_state/id_ed25519" \
      -o IdentitiesOnly=yes -o IdentityAgent=none -o ForwardAgent=no \
      -o BatchMode=yes -o StrictHostKeyChecking=yes \
      -o UserKnownHostsFile="$vm_state/known_hosts" \
      -o HostKeyAlias="$vm_name" -o ConnectTimeout=10 \
      "admin@$vm_ip" "$@"
    ;;
  *)
    printf 'Usage: bash scripts/macos-vm.sh [status|start|stop|ssh|exec <remote-command>]\n' >&2
    exit 2
    ;;
esac
