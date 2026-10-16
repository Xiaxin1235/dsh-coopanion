"""Send fixed test fixtures through QMP. No input is captured."""
import argparse,subprocess,shlex
p=argparse.ArgumentParser();p.add_argument('vmid',type=int,choices=[303,304]);p.add_argument('mode',choices=['typing','typing-again','mouse-only']);a=p.parse_args()
code=r'''
import json,socket,sys,time,subprocess
vmid=int(sys.argv[1]);mode=sys.argv[2]
expected={303:'coop-linux-test',304:'coop-win-test'}[vmid]
cfg=subprocess.check_output(['qm','config',str(vmid)],text=True)
assert ('name: '+expected+'\n') in cfg
s=socket.socket(socket.AF_UNIX);s.settimeout(3);s.connect('/var/run/qemu-server/'+str(vmid)+'.qmp');f=s.makefile('rwb',buffering=0)
assert 'QMP' in json.loads(f.readline())
serial=0
def execute(cmd,args=None):
 global serial
 serial+=1;req={'execute':cmd,'id':serial}
 if args is not None:req['arguments']=args
 f.write((json.dumps(req)+'\n').encode())
 while True:
  msg=json.loads(f.readline())
  if msg.get('id')==serial:
   assert 'error' not in msg,msg
   return msg
execute('qmp_capabilities')
duration={'typing':6.5,'typing-again':2.5,'mouse-only':30}[mode]
end=time.monotonic()+duration;count=0
while time.monotonic()<end:
 if mode.startswith('typing'):
  events=[{'type':'key','data':{'down':down,'key':{'type':'qcode','data':'a'}}} for down in [True,False]]
 else:
  events=[{'type':'rel','data':{'axis':'x','value':4 if count%2==0 else -4}}]
 execute('input-send-event',{'events':events});count+=1;time.sleep(.4)
print(json.dumps({'vmid':vmid,'phase':mode,'fixtureBatches':count,'durationSeconds':duration,'capturedInput':False}))
'''
command='python3 -c '+shlex.quote(code)+' '+str(a.vmid)+' '+shlex.quote(a.mode)
subprocess.run(['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','svc-jam-pve',command],check=True)
