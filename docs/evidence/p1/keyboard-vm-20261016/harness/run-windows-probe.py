from pathlib import Path
import subprocess,base64,sys
root=Path(__file__).resolve().parent
script=(root/'start-windows-probe.ps1').read_text()
command='powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand '+base64.b64encode(script.encode('utf-16le')).decode()
with (root/'windows-qmp-console.log').open('w') as log:
 proc=subprocess.Popen(['ssh','-F',str(root/'ssh_config'),'coop-win-304',command],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
 for line in proc.stdout:
  log.write(line);log.flush()
  if line.strip().startswith('PHASE '):
   print(line,end='',flush=True)
   mode=line.strip().split()[1]
   if mode in ['typing','typing-again','mouse-only']:
    subprocess.run([sys.executable,str(root/'inject-vm.py'),'304',mode],stdout=log,stderr=subprocess.STDOUT,check=True)
 code=proc.wait()
 print('Windows console observer exit:',code)
 sys.exit(code)
