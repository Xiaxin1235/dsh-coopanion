# coding: utf-8
"""Read-only verification of this record's fixed candidate against Git source."""
from pathlib import Path
import hashlib, io, json, subprocess, sys, tarfile
SOURCE = 'ac5938fd0b7bbdf1b716a023a48cab3c6004e77a'
SHA256 = '7bae84f1b152dbf42f21b5b1916e6b9376357d9c02b8e230892119d9bfd7e673'
package = Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(package).hexdigest() == SHA256, 'wrong candidate'
with tarfile.open(fileobj=io.BytesIO(package)) as archive:
    build = json.load(archive.extractfile('package/dist/build-info.json'))
    files = {m.name[8:]: archive.extractfile(m).read() for m in archive if m.isfile() and
             (m.name[8:] in ['scripts/build.mjs', 'package.json', 'npm-shrinkwrap.json'] or
              m.name.startswith(('package/src/', 'package/desktop/', 'package/web/')) and m.name != 'package/web/markdown-runtime.js')}
inputs = {p: hashlib.sha256(files[p]).hexdigest() for p in sorted(files)}
digest = hashlib.sha256(json.dumps(inputs, separators=(',', ':')).encode()).hexdigest()
assert build['commit'] == SOURCE and build['dirty'] is False and build['productDigest'] == digest
repository = Path(__file__).resolve().parents[4]
snapshot = subprocess.check_output(['git', 'archive', SOURCE, 'scripts/build.mjs', 'package.json', 'npm-shrinkwrap.json', 'src', 'desktop', 'web'], cwd=repository)
with tarfile.open(fileobj=io.BytesIO(snapshot)) as archive:
    for path, content in files.items():
        assert archive.extractfile(path).read() == content, path
print(json.dumps({'sourceCommit': SOURCE, 'packageSha256': SHA256, 'productFiles': len(files), 'productDigest': digest, 'bytesMatch': True}, indent=2))
