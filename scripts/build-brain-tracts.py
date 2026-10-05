"""Make deterministic lightweight named bundles from the HCP1065 atlas.

Source archive is fetched by HTTP byte ranges; only selected TRK members are cached.
Requires numpy and nibabel. Derived data remains CC BY-SA 4.0 and HCP terms apply.
"""
from __future__ import annotations
import argparse, concurrent.futures, gzip, hashlib, io, json, struct, urllib.request, zlib
from pathlib import Path
import numpy as np
import nibabel as nib

ARCHIVE = 'https://github.com/data-others/atlas/releases/download/hcp1065/hcp1065_avg_tracts_trk.zip'
SIZE = 587869457
SOURCE_PAGE = 'https://brain.labsolver.org/hcp_trk_atlas.html'
ACK = 'Data were provided by the Human Connectome Project, WU-Minn Consortium (Principal Investigators: David Van Essen and Kamil Ugurbil; 1U54MH091657) funded by the 16 NIH Institutes and Centers that support the NIH Blueprint for Neuroscience Research; and by the McDonnell Center for Systems Neuroscience at Washington University.'

DEFINITIONS = [
    ('commissural/CC.trk.gz', 'corpus-callosum', 'Corpus callosum', 'commissural', 'bilateral', ['corpus-callosum'], 900),
    ('projection/CST_L.trk.gz', 'corticospinal-left', 'Corticospinal tract · left', 'projection', 'left', ['corticospinal'], 420),
    ('projection/CST_R.trk.gz', 'corticospinal-right', 'Corticospinal tract · right', 'projection', 'right', ['corticospinal'], 420),
    ('projection/ML_L.trk.gz', 'medial-lemniscus-left', 'Medial lemniscus · left', 'sensory', 'left', ['dorsal-column'], 350),
    ('projection/ML_R.trk.gz', 'medial-lemniscus-right', 'Medial lemniscus · right', 'sensory', 'right', ['dorsal-column'], 350),
    ('projection/OR_L.trk.gz', 'optic-radiation-left', 'Optic radiation · left', 'sensory', 'left', ['optic-radiation'], 420),
    ('projection/OR_R.trk.gz', 'optic-radiation-right', 'Optic radiation · right', 'sensory', 'right', ['optic-radiation'], 420),
    ('association/AF_L.trk.gz', 'arcuate-left', 'Arcuate fasciculus · left', 'association', 'left', ['association-fibers'], 420),
    ('association/AF_R.trk.gz', 'arcuate-right', 'Arcuate fasciculus · right', 'association', 'right', ['association-fibers'], 420),
    ('association/UF_L.trk.gz', 'uncinate-left', 'Uncinate fasciculus · left', 'association', 'left', ['association-fibers'], 360),
    ('association/UF_R.trk.gz', 'uncinate-right', 'Uncinate fasciculus · right', 'association', 'right', ['association-fibers'], 360),
    ('association/ILF_L.trk.gz', 'inferior-longitudinal-left', 'Inferior longitudinal fasciculus · left', 'association', 'left', ['association-fibers'], 360),
    ('association/ILF_R.trk.gz', 'inferior-longitudinal-right', 'Inferior longitudinal fasciculus · right', 'association', 'right', ['association-fibers'], 360),
    ('association/SLF1_L.trk.gz', 'superior-longitudinal-left', 'Superior longitudinal fasciculus I · left', 'association', 'left', ['association-fibers'], 340),
    ('association/SLF1_R.trk.gz', 'superior-longitudinal-right', 'Superior longitudinal fasciculus I · right', 'association', 'right', ['association-fibers'], 340),
    ('association/C_FP_L.trk.gz', 'cingulum-left', 'Cingulum, frontal–parietal · left', 'association', 'left', ['association-fibers', 'hippocampus'], 300),
    ('association/C_FP_R.trk.gz', 'cingulum-right', 'Cingulum, frontal–parietal · right', 'association', 'right', ['association-fibers', 'hippocampus'], 300),
    ('association/C_PH_L.trk.gz', 'cingulum-temporal-left', 'Cingulum, parahippocampal · left', 'association', 'left', ['association-fibers', 'hippocampus'], 220),
    ('association/C_PH_R.trk.gz', 'cingulum-temporal-right', 'Cingulum, parahippocampal · right', 'association', 'right', ['association-fibers', 'hippocampus'], 220),
    ('projection/F_L.trk.gz', 'fornix-left', 'Fornix · left', 'limbic', 'left', ['hippocampus', 'white-matter'], 240),
    ('projection/F_R.trk.gz', 'fornix-right', 'Fornix · right', 'limbic', 'right', ['hippocampus', 'white-matter'], 240),
    ('cerebellum/MCP.trk.gz', 'middle-cerebellar-peduncle', 'Middle cerebellar peduncle', 'cerebellar', 'bilateral', ['cerebellum', 'brainstem'], 340),
    ('cerebellum/SCP.trk.gz', 'superior-cerebellar-peduncle', 'Superior cerebellar peduncle', 'cerebellar', 'bilateral', ['cerebellum', 'brainstem'], 300),
    ('cerebellum/ICP_L.trk.gz', 'inferior-cerebellar-peduncle-left', 'Inferior cerebellar peduncle · left', 'cerebellar', 'left', ['cerebellum', 'brainstem'], 250),
    ('cerebellum/ICP_R.trk.gz', 'inferior-cerebellar-peduncle-right', 'Inferior cerebellar peduncle · right', 'cerebellar', 'right', ['cerebellum', 'brainstem'], 250),
]


def fetch_range(start: int, end: int) -> bytes:
    request = urllib.request.Request(ARCHIVE, headers={'Range': f'bytes={start}-{end}', 'User-Agent': 'Neuroscience-atlas-asset-build'})
    with urllib.request.urlopen(request, timeout=120) as response:
        assert response.status == 206, 'Archive server must support byte ranges'
        data = response.read()
        assert len(data) == end - start + 1, 'Unexpected archive range length'
        return data


def directory() -> dict:
    tail = fetch_range(SIZE - 131072, SIZE - 1)
    entries = {}; i = 0
    while (i := tail.find(b'PK\x01\x02', i)) >= 0:
        values = struct.unpack_from('<4s6H3I5H2I', tail, i)
        n, extra, comment = values[10:13]
        name = tail[i + 46:i + 46 + n].decode('utf8')
        entries[name] = {'method': values[4], 'crc': values[7], 'compressed': values[8], 'uncompressed': values[9], 'offset': values[16]}
        i += 46 + n + extra + comment
    assert len(entries) > 80
    return entries


def extract(name: str, entry: dict, cache: Path) -> Path:
    path = cache / name.replace('/', '_')
    if path.exists() and path.stat().st_size == entry['uncompressed']:
        return path
    header = fetch_range(entry['offset'], entry['offset'] + 29)
    fields = struct.unpack('<4s5H3I2H', header)
    assert fields[0] == b'PK\x03\x04'
    start = entry['offset'] + 30 + fields[-2] + fields[-1]
    raw = fetch_range(start, start + entry['compressed'] - 1)
    decoded = zlib.decompress(raw, -15) if entry['method'] == 8 else raw
    assert len(decoded) == entry['uncompressed'] and zlib.crc32(decoded) == entry['crc']
    path.write_bytes(decoded)
    print('Cached', name, len(decoded), flush=True)
    return path


def resample(points: np.ndarray, count: int = 40) -> np.ndarray:
    distance = np.concatenate(([0.], np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))))
    if distance[-1] <= 1e-4:
        return np.empty((0, 3))
    sample = np.linspace(0., distance[-1], count)
    return np.column_stack([np.interp(sample, distance, points[:, axis]) for axis in range(3)])


def convert(definition: tuple, path: Path, center_ras: np.ndarray, out: Path) -> dict:
    member, bid, name, category, hemisphere, topics, maximum = definition
    random = np.random.default_rng(20261004 + int(hashlib.sha256(bid.encode()).hexdigest()[:7], 16))
    reservoir = []; source_count = 0; rejected = 0
    with gzip.open(path, 'rb') as stream:
        tractogram = nib.streamlines.TrkFile.load(stream, lazy_load=True).tractogram
        # nibabel applies TrackVis voxel-corner -> scanner RAS+ transformation.
        # LazyTractogram.__iter__ exposes raw .data records; its .streamlines
        # property applies the pending TrackVis affine. Do not iterate records.
        for streamline in tractogram.streamlines:
            points = np.asarray(streamline, dtype=np.float64)
            if len(points) < 2 or not np.isfinite(points).all() or np.max(np.abs(points)) > 250:
                rejected += 1; continue
            sampled = resample(points)
            if not len(sampled):
                rejected += 1; continue
            source_count += 1
            if len(reservoir) < maximum:
                reservoir.append(sampled)
            else:
                index = int(random.integers(0, source_count))
                if index < maximum:
                    reservoir[index] = sampled
    assert source_count and reservoir, f'Empty source bundle {bid}'
    arrays = [np.round((p - center_ras)[:, [0, 2, 1]], 2) for p in reservoir]
    positions = np.concatenate(arrays)
    assert np.max(np.abs(positions)) < 120, f'{bid}: coordinate transform escaped MNI brain bounds'
    if hemisphere == 'left':
        assert np.median(positions[:, 0]) < 0, f'{bid}: left/right orientation reversed'
    elif hemisphere == 'right':
        assert np.median(positions[:, 0]) > 0, f'{bid}: left/right orientation reversed'
    offsets = np.cumsum([0] + [len(p) for p in arrays]).tolist()
    metadata = {'sourceMember': member, 'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'sourceStreamlineCount': source_count, 'rejectedStreamlines': rejected, 'sampling': 'Deterministic uniform reservoir sample; each observed streamline arc-length resampled to 40 points. No synthetic fibers added.'}
    payload = {'version': 1, 'id': bid, 'name': name, 'category': category, 'hemisphere': hemisphere, 'topicIds': topics, 'positions': positions.reshape(-1).tolist(), 'offsets': offsets, 'bounds': [positions.min(0).tolist(), positions.max(0).tolist()], 'metadata': metadata}
    target = out / f'{bid}.json'
    target.write_text(json.dumps(payload, separators=(',', ':'), ensure_ascii=False), encoding='utf8')
    print(bid, source_count, 'source ->', len(reservoir), 'sampled streamlines', flush=True)
    return {k: payload[k] for k in ['id', 'name', 'category', 'hemisphere', 'topicIds', 'bounds']} | {'file': '/brain/models/tracts/' + target.name, 'streamlineCount': len(reservoir), 'pointCount': len(positions), 'byteLength': target.stat().st_size}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=Path('../brain-assets/source/hcp1065'))
    parser.add_argument('--out', type=Path, default=Path('public/brain/models/tracts'))
    parser.add_argument('--atlas', type=Path, default=Path('public/brain/models/atlas.json'))
    parser.add_argument('--only', help='Comma-separated bundle IDs for incremental conversion')
    args = parser.parse_args(); args.cache.mkdir(parents=True, exist_ok=True); args.out.mkdir(parents=True, exist_ok=True)
    center = np.array(json.loads(args.atlas.read_text(encoding='utf8'))['metadata']['coordinates']['centerSourceRAS'])
    definitions = [d for d in DEFINITIONS if not args.only or d[1] in args.only.split(',')]
    entries = directory()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        files = list(pool.map(lambda d: extract(d[0], entries[d[0]], args.cache), definitions))
    bundles = [convert(d, p, center, args.out) for d, p in zip(definitions, files)]
    metadata = {'name': 'HCP1065 Population-Averaged Tractography Atlas', 'year': 2022, 'source': SOURCE_PAGE, 'archiveUrl': ARCHIVE, 'citation': 'Yeh, F.-C. (2022). Population-based tract-to-region connectome of the human brain and its hierarchical topology. Nature Communications 13, 4933. https://doi.org/10.1038/s41467-022-32595-4', 'license': 'CC BY-SA 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/', 'dataUseTerms': 'https://www.humanconnectome.org/study/hcp-young-adult/document/wu-minn-hcp-consortium-open-access-data-use-terms', 'acknowledgment': ACK, 'coordinates': {'units': 'mm', 'x': 'right', 'y': 'superior', 'z': 'anterior', 'centerSourceRAS': center.tolist(), 'sourceSpace': 'ICBM 2009a Nonlinear Asymmetric, MNI RAS+'}, 'limitations': 'Diffusion MRI tractography estimates candidate pathways, not directly observed axons. Population-averaged streamlines do not establish signaling direction, connection certainty, individual anatomy, or axon counts. Allen anatomy uses ICBM2009b symmetric; co-display in MNI coordinates is contextual, not exact cross-template registration. Medial lemniscus data cover the brain portion, not a full spinal dorsal column.', 'derivation': 'Named source bundles, deterministic streamline sampling and uniform arc-length point reduction, coordinate transform and centering. Derived files retain CC BY-SA 4.0; HCP data-use terms apply.'}
    manifest = {'version': 1, 'metadata': metadata, 'bundles': bundles, 'streamlineCount': sum(b['streamlineCount'] for b in bundles), 'pointCount': sum(b['pointCount'] for b in bundles), 'totalBytes': sum(b['byteLength'] for b in bundles)}
    (args.out / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':'), ensure_ascii=False), encoding='utf8')
    print('TOTAL', manifest['streamlineCount'], 'streamlines', manifest['totalBytes'], 'bytes', flush=True)


if __name__ == '__main__':
    main()
