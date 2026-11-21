#!/usr/bin/env python3
"""Offline heuristic release scan. Does not prove absence of all secrets or identify people in images."""
from pathlib import Path
import re,json,base64,sys
root=Path(__file__).resolve().parents[1];hits=[];files=0;embedded=0;binary=0
patterns={
 'private_key':re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
 'cloud_access_key':re.compile(r'\b(?:AKIA[A-Z0-9]{16}|AKID[A-Za-z0-9]{24,})\b'),
 'private_network':re.compile(r'(?<![\w.])(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?![\w.])'),
 'host_path':re.compile(r'/(?:volume\d+|workspace|home/box)/|[A-Z]:\\Users\\'),
 'quoted_openid':re.compile(r'''(['"])o[A-Za-z0-9_-]{27}\1'''),
 'jwt':re.compile(r'\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{15,}\b')}
for p in root.rglob('*'):
 r=p.relative_to(root)
 if any(x in ['node_modules','.git','verification','coverage'] for x in r.parts):continue
 if p.is_symlink():hits.append({'file':str(r),'rule':'symlink'});continue
 if not p.is_file():continue
 files+=1
 if any(x in ['backups','artifacts','logs']for x in r.parts)or(p.suffix.lower()in ['.pem','.key','.p12','.pfx','.crt','.cer','.tgz','.zip','.dump','.log'])or(p.name.startswith('.env')and p.name!='.env.example'):
  hits.append({'file':str(r),'rule':'forbidden_file'})
 raw=p.read_bytes()
 if p.suffix.lower()in ['.jpg','.jpeg','.png']:
  binary+=1
  if b'Exif\x00\x00'in raw:hits.append({'file':str(r),'rule':'image_exif'})
  continue
 try:s=raw.decode('utf-8')
 except UnicodeDecodeError:hits.append({'file':str(r),'rule':'unreviewed_binary'});continue
 for name,pat in patterns.items():
  if pat.search(s):hits.append({'file':str(r),'rule':name})
 for v in re.findall(r'\bwx[0-9a-fA-F]{16}\b',s):
  if v!='wx0000000000000000':hits.append({'file':str(r),'rule':'project_appid'})
 for u in re.findall(r'data:image/(?:jpeg|png|svg\+xml);base64,([A-Za-z0-9+/=]+)',s):
  embedded+=1
  try:data=base64.b64decode(u,validate=True)
  except Exception:hits.append({'file':str(r),'rule':'invalid_embedded_image'});continue
  if b'Exif\x00\x00'in data:hits.append({'file':str(r),'rule':'embedded_exif'})
  for v in re.findall(r'\bwx[0-9a-fA-F]{16}\b',data.decode('utf-8','ignore')):
   if v!='wx0000000000000000':hits.append({'file':str(r),'rule':'embedded_project_appid'})
  for name,pat in patterns.items():
   if pat.search(data.decode('utf-8','ignore')):hits.append({'file':str(r),'rule':'embedded_'+name})
print(json.dumps({'filesScanned':files,'binaryImages':binary,'embeddedImagesChecked':embedded,'findings':hits,'limitations':['heuristic patterns, not a guarantee','no image OCR or legal ownership proof','node_modules/git/generated verification explicitly excluded; ZIP packaging must exclude them too']},ensure_ascii=False,indent=2));sys.exit(1 if hits else 0)
