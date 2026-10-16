from pathlib import Path
import json,re,subprocess,shlex
root=Path(__file__).resolve().parent
text=(root/'vm-configs-before-cleanup.txt').read_text();current=None;uuids={}
for line in text.splitlines():
 if line.startswith('name: '):current=line[6:]
 if line.startswith('smbios1: ') and current in ['coop-linux-test','coop-win-test']:uuids[current]=re.search(r'uuid=([^,\s]+)',line)[1]
assert len(uuids)==2
created=json.loads((root/'create-windows.json').read_text());assert created['instance_uuid']==uuids['coop-win-test']
config={'303':{'name':'coop-linux-test','uuid':uuids['coop-linux-test']},'304':{'name':'coop-win-test','uuid':uuids['coop-win-test']}}
code=r'''
import json,subprocess,pathlib,re,sys,datetime
cfg=json.load(sys.stdin)
def run(*args):return subprocess.check_output(args,text=True).strip()
assert run('hostname')=='pve-jam'
report={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'vms':{}}
for vmid,data in cfg.items():
 content=run('qm','config',vmid)
 assert re.search(r'^name: '+re.escape(data['name'])+r'$',content,re.M)
 assert 'uuid='+data['uuid'] in content
 assert 'template: 1' not in content
 report['vms'][vmid]={'name':data['name'],'uuid':data['uuid'],'volumesBefore':run('pvesm','list','local-lvm','--vmid',vmid)}
meta=pathlib.Path('/var/lib/vz/snippets/win11-304-meta.json')
assert not meta.is_symlink() and json.loads(meta.read_text())['uuid']==cfg['304']['uuid']
for vmid in ['304','303']:
 if run('qm','status',vmid)!='status: stopped':
  result=subprocess.run(['qm','shutdown',vmid,'--timeout','30'],capture_output=True,text=True)
  report['vms'][vmid]['shutdownExit']=result.returncode
  if result.returncode:run('qm','stop',vmid)
 run('qm','destroy',vmid,'--purge','1')
 assert not pathlib.Path('/etc/pve/qemu-server/'+vmid+'.conf').exists()
 remaining=run('pvesm','list','local-lvm','--vmid',vmid)
 assert 'vm-'+vmid+'-disk-' not in remaining
 report['vms'][vmid].update({'configurationRemoved':True,'volumesAfter':remaining})
for name in ['win11-304-meta.json','win11-304-user.ps1']:
 path=pathlib.Path('/var/lib/vz/snippets')/name
 assert path.is_file() and not path.is_symlink();path.unlink()
report['windowsSnippetsRemoved']=True
report['sharedUbuntuOwnerKeyPreserved']=pathlib.Path('/var/lib/vz/snippets/ubuntu-test-owner.pub').is_file()
report['preserved']={vmid:run('qm','status',vmid) for vmid in ['300','302','9300','9400']}
assert report['preserved']=={'300':'status: running','302':'status: running','9300':'status: stopped','9400':'status: stopped'}
report['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
print(json.dumps(report,indent=2))
'''
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','svc-jam-pve','python3 -c '+shlex.quote(code)],input=json.dumps(config),capture_output=True,text=True)
(root/'cleanup-vms.json').write_text(result.stdout)
(root/'cleanup-vms.stderr').write_text(result.stderr)
print('Cleanup exit:',result.returncode)
raise SystemExit(result.returncode)
