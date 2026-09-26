"""Offline audit of saved evidence and aggregate reconciliations."""
from collections import Counter
from pathlib import Path
import csv
import hashlib
import json

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / 'expansion_sources'
read = lambda path: json.loads(path.read_text(encoding='utf-8'))
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    results = read(HERE / 'freshness_results.json')
    assert len(results) == len({r['id'] for r in results}) == 133
    assert sum(r['status'] == 'retrieved' for r in results) == 131
    assert sum(r.get('same_bytes_as_frozen') is True for r in results) == 103
    assert sum(r.get('same_bytes_as_frozen') is False for r in results) == 21
    counts = Counter(r['kind'] for r in results)
    weather = [r for r in results if r['kind'] == 'weather']
    daily = [r for r in weather if r['id'].endswith('.dly')]
    hourly = [r for r in weather if r['id'].endswith('.gz')]
    assert len(daily) == 29 and len(hourly) == 60
    assert all(r['same_1991_2025_records'] and r['same_2021_2024_records'] for r in daily)
    assert all(r['same_bytes_as_frozen'] and r['same_decompressed_bytes'] and r['same_primary_civil_window_records'] for r in hourly)
    assert sum(not r['same_bytes_as_frozen'] for r in daily) == 16
    for name, item in read(OLD / 'weather/raw_manifest.json').items():
        assert sha(OLD / 'weather/raw' / name) == item['sha256'], name
    for item in read(OLD / 'doj/source_metadata.json')['files']:
        assert sha(OLD / 'doj/raw' / item['filename']) == item['sha256'], item['filename']
    assert all(r['same_bytes_as_frozen'] for r in results if r['kind'] in ['doj', 'sandag_aggregate', 'dictionary', 'context'])
    for key in ['pr74-d3tr', 'huzf-mi2z', 'knre-fqwi', 'qbrv-e75t']:
        old = read(OLD / 'local' / (key + '_metadata.json'))
        fresh = read(HERE / 'responses' / ('sandag_' + key + '.json'))
        old['columns'] = [{k: row.get(k) for k in ['fieldName', 'name', 'dataTypeName', 'description']}
                          for row in old['columns'] if not row.get('fieldName', '').startswith(':')]
        assert old == fresh, key
    diff = read(HERE / 'sdpd_2026_daily_count_changes.json')
    assert len(diff) == 27 and sum(r['difference'] for r in diff) == 244
    assert diff[-1] == {'date': '2026-09-24', 'frozen_source_rows': 0, 'current_source_rows': 95, 'difference': 95}
    by_date = Counter()
    for suffix, expected_cells in [('daily', 1335), ('monthly_offense', 416)]:
        name = 'sdpd_nibrs_2026_' + suffix
        rows = read(HERE / (name + '.json'))
        csv_rows = list(csv.DictReader((HERE / (name + '.csv')).open(encoding='utf-8', newline='')))
        assert len(rows) == len(csv_rows) == expected_cells
        assert [{k: str(v) for k, v in r.items()} for r in rows] == csv_rows
        assert sum(r['source_rows'] for r in rows) == 57037
        if suffix == 'daily':
            for row in rows:
                assert row['distinct_nibrs_offense_ids'] == row['source_rows']
                assert 0 <= row['distinct_case_numbers'] <= row['source_rows']
                by_date[row['date']] += row['source_rows']
    assert dict(by_date) == {r['date']: r['source_rows'] for r in read(HERE / 'sdpd_2026_current_daily_counts.json')}
    meta = read(HERE / 'sdpd_2026_refresh_metadata.json')
    fresh_result = next(r for r in results if r['id'] == 'sdpd_2026')
    assert meta['sha256'] == fresh_result['sha256'] and meta['source_rows'] == 57037
    safe = {'status': 'PASS', 'requests_verified': 133, 'frozen_raw_files_hash_verified': 97,
            'sandag_normalized_metadata_unchanged': 4, 'sandag_aggregate_responses_unchanged': 14,
            'sdpd_2026_source_rows': 57037, 'sdpd_net_new_rows': 244,
            'sdpd_new_day_rows': 95, 'sdpd_prior_date_net_revisions': 149,
            'sdpd_daily_cells': 1335, 'sdpd_monthly_offense_cells': 416,
            'noaa_daily_historical_windows_unchanged': 29, 'noaa_hourly_files_unchanged': 60,
            'noaa_inventory_files_unchanged': 3, 'models_refit': 0, 'request_counts_by_kind': dict(counts)}
    (HERE / 'offline_verification.json').write_text(json.dumps(safe, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(safe, indent=2))


if __name__ == '__main__':
    main()
