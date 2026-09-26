"""Reproduce safe 2026 SDPD aggregates from a hash-pinned public response.

The record-level response is processed in memory and never written to disk.
Case/offense identifiers contribute only to distinct counts within daily cells.
"""
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
import csv
import hashlib
import io
import json

HERE = Path(__file__).resolve().parent
URL = 'https://seshat.datasd.org/police_nibrs/pd_nibrs_2026_datasd.csv'
EXPECTED = '465589d9a9f809924014601759a6b9a29c413fcc76978358554c93db93898230'


def save(name, value):
    (HERE / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def table(name, rows):
    with (HERE / (name + '.csv')).open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    save(name + '.json', rows)


def main():
    started = datetime.now(timezone.utc).isoformat()
    with urlopen(Request(URL, headers={'User-Agent': 'Public-data-source-audit/1.0'}), timeout=90) as response:
        body = response.read()
        metadata = {'url': URL, 'final_url': response.url, 'retrieved_utc': started,
                    'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(),
                    'response_headers': {k: v for k, v in response.headers.items()
                                         if k.lower() in ['date', 'last-modified', 'etag', 'content-type', 'content-length']}}
    if metadata['sha256'] != EXPECTED:
        raise ValueError('Upstream changed since freshness audit; review new response before updating the pinned aggregate release.')
    daily = defaultdict(lambda: [0, set(), set()])
    monthly = Counter()
    dates = Counter()
    all_offenses = set()
    reader = csv.DictReader(io.StringIO(body.decode('utf-8-sig')))
    count = missing = 0
    for source in reader:
        row = {k.lower(): v for k, v in source.items()}
        count += 1
        date = row.get('occured_on', '')[:10]
        if not date:
            date = 'UNASSIGNED'
            missing += 1
        dates[date] += 1
        group, category = row.get('group_type', 'UNKNOWN'), row.get('crime_against', 'UNKNOWN')
        cell = daily[(date, group, category)]
        cell[0] += 1
        if row.get('nibrs_uniq'):
            cell[1].add(row['nibrs_uniq'])
            all_offenses.add(row['nibrs_uniq'])
        if row.get('case_number'):
            cell[2].add(row['case_number'])
        monthly[(date[:7], group, row.get('ibr_offense', ''), row.get('ibr_offense_description', ''))] += 1
    daily_rows = [{'date': k[0], 'group_type': k[1], 'crime_against': k[2], 'source_rows': v[0],
                   'distinct_nibrs_offense_ids': len(v[1]), 'distinct_case_numbers': len(v[2])}
                  for k, v in sorted(daily.items())]
    monthly_rows = [{'month': k[0], 'group_type': k[1], 'offense_code': k[2],
                    'offense_description': k[3], 'source_rows': v} for k, v in sorted(monthly.items())]
    assert sum(r['source_rows'] for r in daily_rows) == count == sum(r['source_rows'] for r in monthly_rows)
    prior_check = json.loads((HERE / 'sdpd_2026_current_daily_counts.json').read_text(encoding='utf-8'))
    assert {r['date']: r['source_rows'] for r in prior_check} == dict(dates)
    table('sdpd_nibrs_2026_daily', daily_rows)
    table('sdpd_nibrs_2026_monthly_offense', monthly_rows)
    valid = sorted(d for d in dates if d != 'UNASSIGNED')
    metadata.update(year=2026, source_rows=count, distinct_nibrs_offense_ids=len(all_offenses),
                    rows_minus_distinct_ids=count-len(all_offenses), missing_occurrence_date_rows=missing,
                    first_date=valid[0], last_date=valid[-1], days_with_rows=len(valid),
                    columns=reader.fieldnames, daily_cells=len(daily_rows), monthly_offense_cells=len(monthly_rows),
                    row_reconciliation=True, daily_date_counts_match_initial_audit=True,
                    raw_record_retention=False, identifiers_retained=False,
                    caution='Occurrence-date source rows; not arrests, victims, DV cases, or counts of all unique cases. Distinct cases within cells are not additive across cells. Partial 2026 is subject to delayed reporting and revisions.')
    save('sdpd_2026_refresh_metadata.json', metadata)
    print(json.dumps({k: metadata[k] for k in ['source_rows', 'daily_cells', 'monthly_offense_cells', 'sha256', 'row_reconciliation']}))


if __name__ == '__main__':
    main()
