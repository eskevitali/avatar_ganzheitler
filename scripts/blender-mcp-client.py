"""Local Blender add-on JSON/TCP client. Uses the installed add-on protocol.
Commands are explicit; does not launch/install Blender or modify its preferences.
"""
import argparse,json,socket,pathlib
p=argparse.ArgumentParser();p.add_argument('--code');p.add_argument('--request');p.add_argument('--timeout',type=float,default=30);a=p.parse_args()
command={'type':'execute_code','params':{'code':pathlib.Path(a.code).read_text()}}if a.code else json.loads(a.request or '{"type":"ping","params":{}}')
with socket.create_connection(('127.0.0.1',9876),timeout=3)as s:
 s.settimeout(a.timeout);s.sendall(json.dumps(command).encode());data=b''
 while len(data)<20_000_000:
  chunk=s.recv(65536)
  if not chunk:raise RuntimeError('Blender disconnected before its JSON response')
  data+=chunk
  try:result=json.loads(data);break
  except json.JSONDecodeError:continue
 else:raise RuntimeError('Blender response too large')
print(json.dumps(result,ensure_ascii=False))
if result.get('status')!='success':raise SystemExit(1)
