"""Build the small, public SCADS browser fixtures from their original sources.

Usage: python scripts/build-scads-demo-data.py /path/to/SCADS-2026-Problems
Only the named public fixtures and reviewed observations are copied. No runtime
workspace, model requests, private data, or source PDF binaries are included.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source_root", type=Path)
parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "public/data/scads")
args = parser.parse_args()
root = args.source_root.resolve()
out = args.output
out.mkdir(parents=True, exist_ok=True)
sources = {}


def read(path):
    data = (root / path).read_bytes()
    sources[str(path).replace("\\", "/")] = hashlib.sha256(data).hexdigest()
    # Workspace text evidence hashes use Python's universal-newline reading.
    return data.decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")


def document(path):
    return json.loads(read(path))


def rows(path):
    return list(csv.DictReader(read(path).splitlines()))


def lines(path):
    return [json.loads(line) for line in read(path).splitlines() if line.strip()]


def save(slug, payload):
    (out / f"{slug}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


p = Path("projects/01-sensemaking")
report = document(p / "examples/local-riverwatch-guidance-accepted/report.json")
ledger = document(p / "examples/local-riverwatch-guidance-accepted/evidence-ledger.json")
records = {r["id"]: r for r in rows(p / "data/records.csv")}
manifest = {r["id"]: r for r in document(p / "data/manifest.json")}
evidence = []
for item in ledger:
    if item["id"] in records:
        record = records[item["id"]]
        text = record["text"]
        title = record["title"]
    else:
        record = manifest[item["id"]]
        text = read(p / "data" / record["path"])
        title = record["title"]
    assert hashlib.sha256(text.encode("utf-8")).hexdigest() == item["sha256"], item["id"]
    evidence.append({"id": item["id"], "title": title, "date": item["date"], "path": item["source"], "text": text})
questions = ["How ready is Riverwatch?", "What does deployment depend on?", "When are the sensors expected?", "Does pending acceptance mean defective?"]
findings = []
for i, finding in enumerate(report["findings"]):
    ids = list(finding["evidence_ids"])
    if i == 0:
        ids.insert(0, "tbl-003")
    findings.append({"question": questions[i], **finding, "evidence_ids": ids})
save(p.name, {"kind": "recorded-analysis-of-synthetic-fixture", "findings": findings, "evidence": evidence})

p = Path("projects/02-311-analytics")
requests = lines(p / "fixtures/requests.jsonl")
metadata = document(p / "fixtures/manifest.json")
assert len(requests) == metadata["row_count"] == 32
fields = ["unique_key", "created_date", "borough", "complaint_type", "agency", "status", "is_closed", "closure_hours"]
save(p.name, {"kind": metadata["kind"], "source": metadata["source"], "rows": [{k: r[k] for k in fields} for r in requests]})

p = Path("projects/03-semantic-discovery")
leads = {r["lead_id"]: r for r in document(p / "data/corpus/evidence-leads.json")["leads"]}
review = document(p / "examples/agent-review-decisions.json")
corpus = {r["document"]["doc_id"]: r for r in lines(p / "data/corpus-manifest.jsonl")}
observations = []
fields = ["lead_id", "doc_id", "pdf_page", "model", "attribute", "value", "value_max", "unit", "qualifier", "subject", "source_quote", "conditions", "notes"]
for doc in review["documents"]:
    for decision in doc["decisions"]:
        assert decision["decision"] in ("accept", "correct")
        lead = leads[decision["lead_id"]]
        source = corpus[lead["doc_id"]]
        assert lead["admission_status"] == source["admission_status"] == "admitted"
        assert lead["document_sha256"] == doc["document_sha256"] == source["sha256"]
        assert lead["pdf_page"] == decision["source_page"]
        observation = {k: lead.get(k) for k in fields}
        observation.update({k: v for k, v in decision["correction"].items() if k in fields})
        observation.update({"title": source["document"]["title"], "source_url": source["document"]["source_uri"], "review": "Agent-reviewed development observation"})
        observations.append(observation)
assert len(observations) == 14
save(p.name, {"kind": "source-inspected-development-observations", "observations": observations})

p = Path("projects/04-org-knowledge-graphs")
roster = rows(p / "fixtures/sample-roster.csv")
messages = rows(p / "fixtures/sample-communications.csv")
entities = [{"id": r["Employee ID"], "name": r["Full Name"], "role": r["Role"], "department": r["Department"], "type": r["Entity Type"], "manager": r["Manager ID"], "valid_from": r["Valid From"]} for r in roster]
addresses = {r["Email"]: r["Employee ID"] for r in roster}
edges = []
for r in roster:
    if r["Manager ID"]:
        edges.append({"from": r["Employee ID"], "to": r["Manager ID"], "kind": "reporting", "label": "reports to", "id": "roster-" + r["Employee ID"], "date": r["Valid From"], "evidence": f"Roster declaration: {r['Full Name']} ({r['Employee ID']}) → manager ID {r['Manager ID']}; valid from {r['Valid From']}.", "source": "fixtures/sample-roster.csv"})
seen = set()
for msg in messages:
    if msg["Message ID"] in seen or not msg["From"] or not msg["Sent At"]:
        continue
    sender = next((entity for address, entity in addresses.items() if "<" + address + ">" in msg["From"]), None)
    recipient = next((entity for address, entity in addresses.items() if "<" + address + ">" in msg["To"]), None)
    if sender and recipient:
        seen.add(msg["Message ID"])
        edges.append({"from": sender, "to": recipient, "kind": "communication", "label": "sent a message to", "id": msg["Message ID"], "date": msg["Sent At"], "title": msg["Subject"], "evidence": msg["Body"], "source": "fixtures/sample-communications.csv"})
assert len(entities) == 6 and len(edges) == 6
save(p.name, {"kind": "fictional-source-fixture", "entities": entities, "edges": edges})

p = Path("projects/05-graphrag-discovery/fixtures/pump")
manifest = document(p / "manifest.json")
batches = []
for batch in manifest["batches"]:
    records = lines(p / batch["records"])
    assertions = document(p / batch["assertions"])
    for assertion in assertions:
        record = next(r for r in records if r.get("document_id") == assertion["document_id"] and r.get("version_id") == assertion["version_id"])
        assert record["text"][assertion["start"]:assertion["end"]] == assertion["text"]
        assert hashlib.sha256(record["text"].encode("utf-8")).hexdigest() == record["content_sha256"]
    batches.append({"id": batch["id"], "published_at": batch["published_at"], "records": [{k: r.get(k) for k in ["document_id", "version_id", "operation", "source_available_at", "reason"]} for r in records], "assertions": assertions})
gold = document(p / "gold.json")
save("05-graphrag-discovery", {"kind": "authored-temporal-fixture", "batches": batches, "verificationCases": gold["states"]})
save("provenance", {"builder": "scripts/build-scads-demo-data.py", "sources_sha256": dict(sorted(sources.items()))})
print(f"Built five public browser datasets; {len(sources)} source fingerprints.")
