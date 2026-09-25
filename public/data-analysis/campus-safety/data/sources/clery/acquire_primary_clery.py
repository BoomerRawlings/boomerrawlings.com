"""Acquire only the two frozen 2025 source files listed in the public manifest.

No account, token, historical collection or contact API is required. Reject any
upstream revision whose bytes no longer match the documented source vintage.
"""
from pathlib import Path
import hashlib
import json
import urllib.request

HERE = Path(__file__).resolve().parent
RAW = HERE / 'raw'
RAW.mkdir(exist_ok=True)
manifest = json.loads((HERE / 'source_metadata_primary_2025.json').read_text(encoding='utf-8'))
for source in manifest['files']:
    filename = source['filename']
    assert Path(filename).name == filename
    destination = RAW / filename
    if destination.exists():
        data = destination.read_bytes()
    else:
        with urllib.request.urlopen(source['url'], timeout=180) as response:
            data = response.read()
    assert len(data) == source['bytes'], 'Upstream source size changed: ' + filename
    assert hashlib.sha256(data).hexdigest() == source['sha256'], 'Upstream source hash changed: ' + filename
    if not destination.exists():
        destination.write_bytes(data)
    print(filename, 'verified', source['sha256'])
