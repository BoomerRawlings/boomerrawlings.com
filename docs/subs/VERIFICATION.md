# Dataset implementation verification

Verified2026-10-27. Generated fixtures are test data; none count toward submarine collection quotas or enter production releases.

## Python toolkit

Fifteen unit tests pass. Coverage: original/crop identity, thumbnail/corrupt/blur/upscale rejection, permission-before-download, independent verification, exact/recompressed duplicates, satellite resolution, safe relative paths, resumed HTTP transfers, checksum schema, immutable release boundaries, crop corrections, Unicode authors/class names, balanced rights tiers, connected capture groups, and RGB image/label loading.

```sh
python -m pip install -r tools/subs/requirements.txt
python -m unittest discover -s tools/subs/tests -v
```

Tested in the existing Python3.14/Pillow12.2 environment and a fresh Python3.14 virtual environment with Pillow12.3.

## Actual Worker → fresh Python proof

Real Worker source, D1 migrations and R2 bindings run in Miniflare. Its200-image synthetic release is published through the actual release endpoint. The freshly installed Python toolkit downloads and resumes that release:

- 400 original/crop assets downloaded;200 RGB images decoded with correct class labels.
- All six metadata checksums verified using the Worker's `{algorithm:"sha256",files:[{filename,sha256,bytes}]}` schema.
- Original/crop SHA-256 digests verified; grouped splits validated.
- Same-release resume succeeds. A different release cannot reuse the directory.
- `COMPLETE.json` written atomically last; interrupted builds/downloads cannot load as complete datasets. No directory rename required on Windows.
- Provisional/audit status retained; no trained-model accuracy claimed.

Reproduce from a fresh environment after installing backend dependencies:

```sh
npm ci --prefix workers/subs
python -m venv tools/subs/.venv
tools/subs/.venv/bin/python -m pip install -e tools/subs
tools/subs/.venv/bin/python tools/subs/tests/run_worker_proof.py --output tmp/subs-worker-proof
```

On Windows use `py -3.14 -m venv` and `tools/subs/.venv/Scripts/python.exe`. The final command starts/stops the loopback-only fixture automatically; port8788 must be free. No production targets or credentials are used. Detailed proof output is written beside the ignored download directory.

The one-command wrapper also passed on Windows, including graceful fixture shutdown and confirming port8788 closed afterward.

## Correction boundary

Before editing, inspect the current remote image record and reproduce the intended reviewed changes in a local correction patch. `correct-local` regenerates native crop pixels and invalidates acceptance. `sync --update-metadata` is an explicit replacement, using the current server revision; it can replace older local fields, so do not apply it to a stale local copy of a browser-edited record. Without that flag, divergent metadata is not silently overwritten. Reverification is mandatory after corrections; originals remain unchanged.

## Real pilot

Six actual original photographs inspected independently against exact source/caption/license pages. Five eligible examples cover Virginia, Los Angeles, Type212A, Project877 Kilo, and Yuan. Partial views/obstructions retained as tags. One earlier Virginia image held because private-contractor credit conflicts with the assumed federal-work public-domain basis; a named Navy photographer's image replaced it. No fake balanced release bypasses the100-original/class publication floor. Human release audits remain pending.
