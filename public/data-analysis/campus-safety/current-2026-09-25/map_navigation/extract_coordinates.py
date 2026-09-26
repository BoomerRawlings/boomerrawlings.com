"""Extract the existing study cohort's institutional coordinates from frozen HD2024.

Run from this directory with Python 3. No network request or crime-data mutation.
"""
from pathlib import Path
import csv
import hashlib
import io
import json
import zipfile

HERE = Path(__file__).resolve().parent
STUDY = HERE.parents[1]
SITE = STUDY.parent / "boomerrawlings.com"
RAW = STUDY / "sources/enrollment/raw/HD2024.zip"
DATASET = SITE / "public/data-analysis/campus-safety/current-2026-09-25/dataset.json"
CONTEXT = SITE / "src/data/campus-school-context.json"

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

dataset = json.loads(DATASET.read_text(encoding="utf-8"))
context = json.loads(CONTEXT.read_text(encoding="utf-8"))
with zipfile.ZipFile(RAW) as archive:
    rows = list(csv.DictReader(io.TextIOWrapper(archive.open("HD2024.csv"), encoding="utf-8-sig")))
indexed = {row["UNITID"]: row for row in rows}
assert len(indexed) == len(rows), "Duplicate NCES UNITID"
selected = []
for school in dataset["institutions"]:
    row = indexed[school["id"]]
    assert row["STABBR"] == school["state"] == context[school["id"]]["homeState"]
    assert row["INSTNM"] == school["officialName"], f"Published institutional name mismatch: {school['id']}"
    point = {
        "id": row["UNITID"], "name": school["name"], "officialName": row["INSTNM"],
        "city": row["CITY"], "state": row["STABBR"], "stateFips": row["FIPS"].zfill(2),
        "region": context[school["id"]]["region"],
        "longitude": float(row["LONGITUD"]), "latitude": float(row["LATITUDE"]),
    }
    assert -180 <= point["longitude"] <= 180 and -90 <= point["latitude"] <= 90
    selected.append(point)
assert len(selected) == len({point["id"] for point in selected}) == 42
output = {
    "source": {
        "id": "nces-hd2024", "label": "NCES IPEDS 2024 institutional directory (HD2024)",
        "url": "https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip",
        "archiveSha256": sha(RAW), "archiveMember": "HD2024.csv",
        "fields": ["UNITID", "INSTNM", "CITY", "STABBR", "FIPS", "LONGITUD", "LATITUDE"],
        "use": "Institutional home-location navigation only; not crime-event locations or reporting-property boundaries.",
    },
    "inputDatasetSha256": sha(DATASET),
    "institutions": selected,
}
(HERE / "hd2024_coordinates.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Extracted {len(selected)} identity/state-matched institutional points; original HD2024 ZIP SHA256 {sha(RAW)}")
