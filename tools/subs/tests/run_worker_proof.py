"""One command: start an isolated actual Worker fixture, run Python proof, stop it."""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("tmp/subs-worker-proof"))
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", 8788)) == 0:
            raise SystemExit("Port8788 is in use. Stop the prior local fixture before running the isolated proof.")
    node = shutil.which("node")
    if not node:
        raise SystemExit("Node.js is required; install workers/subs dependencies with npm ci first.")
    ready = threading.Event()
    creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    server = subprocess.Popen([node, "workers/subs/test/serve-fixture.mjs"], cwd=repo,
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                              encoding="utf-8", errors="replace", creationflags=creationflags)

    def read_output():
        for line in server.stdout:
            if line.startswith("READY "):
                ready.set()

    thread = threading.Thread(target=read_output, daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 120
        while not ready.wait(0.5):
            if server.poll() is not None:
                raise SystemExit("Worker fixture startup failed. Run its documented command to inspect the local error.")
            if time.monotonic() > deadline:
                raise SystemExit("Worker fixture did not become ready within120seconds.")
        environment = os.environ.copy()
        environment["PYTHONPATH"] = str(repo / "tools" / "subs") + os.pathsep + environment.get("PYTHONPATH", "")
        result = subprocess.run([sys.executable, "tools/subs/tests/worker_ingestion_proof.py", "--release", "fixture-r1",
                                 "--output", str(args.output.resolve())], cwd=repo, env=environment, timeout=180)
        return result.returncode
    finally:
        try:
            if server.poll() is None:
                server.stdin.write("stop\n")
                server.stdin.flush()
            server.wait(timeout=15)
        except (subprocess.TimeoutExpired, OSError):
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=10)


if __name__ == "__main__":
    raise SystemExit(main())
