# Reproduction guide

This package is a separate source supplement, not an extension of the fitted-model result table. `publication_validation.json` identifies the curated files and frozen hashes. The original study and 166 previously released artifacts remain unchanged.

Use Python 3.11+ in a virtual environment. Install `requirements.txt`. From the extracted package root:

```text
python audit_sources.py
python build_supplement.py
```

The first command independently checks acquired aggregate data and every complete sampled civil-day temperature. The second rebuilds this supplement PDF, inventory and narrative; it does not fit models. Font files are supplied by ReportLab. PDF binary hashes can vary because document creation metadata differ.

For observed-weather comparisons, run `python compare_noaa.py` and `python verify_noaa.py` within `weather/`. Four public aggregate input extracts are included, with source hashes. The full raw replay additionally requires the archived NOAA downloads. `expand_noaa.py` can acquire those sources, rejecting bytes that differ from the frozen manifest.

Within `doj/`, `python acquire_doj.py` downloads the five official sources and verifies their frozen hashes; `python normalize_doj.py` recreates the ten aggregate CSVs. The published comparison inputs contain only previously public monthly/yearly counts. `portable_reproduction_verification.json` records a successful clean extraction, download and exact output-hash reproduction. The statewide bulk files and dictionaries are not duplicated in this compact bundle.

Within `local/`, `acquire_local.py` queries official public APIs and processes SDPD CSVs in memory. The live endpoints are mutable; a new request is a new snapshot and may not reproduce earlier bytes or totals. Snapshot timing, query hashes and no-identifier schema audits are retained. See `README.md` for manually transcribed Sheriff report values and source-access limits.

Within `context/`, `acquire_context.py` reproduces the nine-city Census extraction from the official table, checking its frozen source hash. Direct Sheriff-page downloads were denied; official cited page results were used, and no local page-byte hashes are claimed.

The combined archive excludes raw arrest exports, case/person identifiers, incident addresses, caches and large raw weather archives. Daily crime data are agency-level aggregates. Hourly timestamps and station coordinates describe weather observations. Aggregates from different sources must not be combined as a single count or converted into a completeness percentage.
