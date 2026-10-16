from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parent
command='export PATH="$HOME/coop-keyboard/toolchain/node-v24.21.0-linux-x64/bin:$PATH"; export DISPLAY=:0; cd "$HOME/coop-keyboard"; dbus-run-session -- node vm-npc-probe.mjs candidate/package vm-package-results'
with (root/'linux-qmp-package-npc.log').open('w') as log:
 proc=subprocess.Popen(['ssh','-F',str(root/'ssh_config'),'coop-linux-303',command],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
 for line in proc.stdout:
  log.write(line);log.flush();print(line,end='',flush=True)
  if line.strip() in ['PHASE typing','PHASE typing-again','PHASE mouse-only']:
   mode=line.strip().split()[1]
   subprocess.run([sys.executable,str(root/'inject-vm.py'),'303',mode],stdout=log,stderr=subprocess.STDOUT,check=True)
 code=proc.wait()
 sys.exit(code)
