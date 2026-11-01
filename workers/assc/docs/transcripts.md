# Transcript library

The library separates immutable originals, structured reading documents, and a lightweight catalog. All three belong under `.private/` and must be served only through authenticated routes. Do not copy them to a static site, public repository, public search index, or public preview.

## Import

Run from the project folder, using material you supplied, own, have permission to retain, or that is in the public domain:

```powershell
node scripts/import-transcript.mjs 'C:\path\recording.vtt' --title 'Recording title' --rights user-supplied --source-url 'https://example.org/recording' --source-id recording-source --date 2026-11-01 --topic 'Organizing' --topic 'Public appearances'
```

`--rights` is required. It records the declared basis; it neither grants permission nor authorizes republication. The tool makes no network requests. It accepts UTF-8 `.txt`, `.srt`, `.vtt`, and `.json`, up to 64 MiB per file. Original bytes are retained exactly, including BOM and line endings. Invalid text encodings, malformed cues, unsafe IDs, or duplicate imports stop without overwriting an existing record.

Optional `--id` gives a stable lowercase ID. Otherwise, the ID derives from the original's SHA-256. `--speaker` supplies an explicit default speaker; it is never inferred from appearance or subject matter. VTT voice tags and leading `Name: ` cue labels are indexed as supplied. Unlabeled turns say `Unattributed`. Cue text retains the original tags and labels; the importer does not silently remove them. A plain text file becomes one turn with no invented timestamps or speaker changes.

## Storage contract

```text
.private/transcripts.json                 lightweight catalog: { records: [...] }
.private/transcripts/<id>.json            one full document, loaded on demand
.private/originals/<sha256>.<extension>   immutable original bytes
```

A catalog record contains:

```json
{
  "id": "recording-001",
  "title": "Recording title",
  "date": "2026-11-01",
  "speakers": ["Explicit speaker"],
  "topics": ["Topic"],
  "sourceId": "recording-source",
  "sourceUrl": "https://example.org/recording",
  "rights": "user-supplied",
  "status": "Imported — not editorially reviewed",
  "turnCount": 1,
  "documentFile": "recording-001.json",
  "originalFilename": "<sha256>.vtt",
  "provenance": {
    "sha256": "<original-byte-hash>",
    "originalName": "recording.vtt",
    "byteLength": 123,
    "format": "vtt",
    "encoding": "UTF-8",
    "importedAt": "<ISO timestamp>",
    "rightsBasis": "user-supplied",
    "readingVersion": 1,
    "transformations": "Timing and explicit speaker labels indexed; source text and initial reading text are identical. No corrections applied."
  }
}
```

The document repeats that metadata and adds `originalText` and `turns`. Each turn contains stable `id`, explicit `speaker`, `startSeconds`, `endSeconds`, `text`, `readingText`, and `annotations`. Missing timing is `null`; it must remain unknown instead of being shown as an asserted zero. `text` is the source baseline. The first `readingText` is identical. Both remain plain text in the UI; never render transcript content as HTML.

For JSON imports, supply an array of turns or `{ "turns": [...] }`, with each turn containing `text`, and optional `speaker`, `startSeconds`, and `endSeconds`. The importer assigns sequential turn IDs. It does not promote supplied `readingText` or annotations into source text. Full original JSON is preserved, so no input metadata is lost from the archive.

## Editing and indexing

Edited reading versions may change `readingText` while leaving `text`, the original file, its hash, and turn IDs unchanged. Every correction or omission must have an annotation giving its reason and scope. Editorial notes must remain distinct from spoken words. Increase `provenance.readingVersion` and retain earlier versions before editing; this importer deliberately provides no overwrite or automatic correction command.

Catalog metadata supports date, speaker, source, and topic filters without sending full transcripts to list views. Detailed documents are loaded individually. A future full-text index can be built from these documents as a disposable private derivative; it must never become the authority for verbatim text. Bios, graph edges, and timeline events can link to the stable document/turn pair. No relationship is inferred merely from a shared name or topic.

Imports take an exclusive `.transcripts-import.lock` and atomically replace the catalog only after writing the full document. A crash can leave an unreferenced original/document; it never deletes originals. If a lock survives interruption, confirm no import process is active and inspect the catalog and document before manually clearing it. Do not rerun blindly or discard an orphan that might be the only preserved copy.
