---
title: iCloud Media Migration and Catalog
slug: organizing-icloud-media
type: work
description: A supervised system built to export, verify, prepare, and search 31,550 iCloud media files without changing the originals.
date: "2026-08"
visualEvidence:
  - role: process
    kind: image
    src: /media/projects/organizing-icloud-media/archive-catalog-pipeline.svg
    alt: Minimal numbered signal path connecting a read-only source to identity, preparation, an integrity gate, analysis, evidence capture, indexing, and a local viewer.
    caption: 31,550 files / 612.9 GiB / SHA-256 identity / 31,528 prepared inputs / 225 tests / SQLite FTS / local viewer
    width: 1621
    height: 77
    fullSizeLink: false
curatorNotes:
  - "This began with a practical limit: iCloud's web download allows 1,000 items in one selection. Boomer needed to move 31,550 files, track every batch, and know what had actually arrived."
  - "Each file receives a SHA-256 identity. The originals remain read-only while supported images are prepared and analyzed in a separate workspace, so every result can still be traced to its source."
  - "Before a new scale run began, the integrity gate caught four pilot results that were not reliable enough. The system stopped before making new model calls. Small Projects is next."
nextExhibit:
  href: /work/interactive-systems/
  label: Small Projects
tags:
  - media organization
  - media preservation
  - data provenance
  - local-first software
status: published
featured: true
---

**31,550 files · 612.9 GiB · 27,906 images · 3,644 videos**

## Why the iCloud export needed its own system

[Apple's iCloud.com download interface allows up to 1,000 photos or videos in one selection](https://support.apple.com/en-us/111762). Moving 31,550 files through that interface would require at least 32 separate selections. Other iCloud routes can sync or download a library, but they do not provide the transfer inventory, retry history, file verification, and local catalog that this migration required.

I built this system because downloading the files was only the first part of the job. I also needed to know what arrived, preserve the original bytes, restart interrupted work safely, and make the finished collection searchable. Each stage was added in response to the problem exposed by the stage before it.

## 1. Track each download

The work began with supervised batches. Each batch had an expected inventory, and failed or interrupted items stayed visible for retry instead of disappearing into a folder of downloads. A download finishing was not treated as proof that the collection was complete.

At this scale, a visible failure can be repaired. A missing file that looks like a successful transfer is much harder to find later.

## 2. Identify and verify every file

Once a file was local, the system streamed it through SHA-256 hashing and recorded its filesystem and format metadata. It also tracked exact duplicates and relationships among files.

This gave each original a content-based identity before any conversion or analysis began. Renamed files, copied files, and identical bytes in different locations could be handled without relying on filenames alone. Every later record could point back to an exact source identity.

## 3. Prepare separate working copies

The source collection remains read-only. Decoded images, prepared inputs, model observations, and database records live in a separate derived workspace. Later processing can be repeated or discarded without altering the original files.

The implemented analysis path covers supported static images. JPEG, PNG, and WebP files can be staged byte for byte. Multi-frame MPO files are expanded into their constituent images in authoritative order. One documented preparation turned 24,653 assets into 31,528 ordered inputs, each with its own hash and source link. Videos remain cataloged as originals; this implementation does not claim frame-by-frame video analysis.

## 4. Check the files before analysis

Preparation created another question: did the new inputs, prior records, and expected order still agree? The next version added an exact integrity gate before the model runner.

At the documented checkpoint, that gate caught four low-fidelity pilot observations and stopped the new scale run before it made any model calls. The check prevented weak prior results from silently becoming the foundation for a much larger run.

## 5. Analyze one image at a time

After the integrity gate, the runner handles one supported image at a time. Every response must match a strict JSON schema covering visible text, normalized transcription, language and script, scene content, objects, activity, interface details, semantic description, and uncertainty.

The fixed structure makes results comparable and searchable. Malformed, filtered, ambiguous, interrupted, and partial responses remain explicit states instead of being rewritten as successful observations.

## 6. Record every attempt

Each attempt records the prepared input, prompt and schema versions, model configuration, usage, terminal state, and error evidence. A completed result enters the catalog through a database transaction.

If a response arrives but the transaction is interrupted, recovery inspects the existing event evidence before deciding what happened. It does not automatically submit the image again. This keeps an interrupted write from turning into an unexplained duplicate model call.

## 7. Build the search index

Once the observations were durable and traceable, the system could build search. SQLite full-text search covers filenames, visible text, normalized transcription, and semantic summaries.

Each result remains connected through its prepared input and catalog identity to the original file. The index does not become a detached pile of tags with no way to verify where they came from.

## 8. Keep the viewer local

The final step was a local viewer for inspecting the catalog. It binds only to `127.0.0.1`, opens the database in query-only mode, and never serves the original media.

## Testing followed the pipeline

The redacted source snapshot contains 225 named tests across 16 test modules, plus a supervisor harness. The tests cover corrupted files, format mismatches, unsafe paths, database rollback, concurrent execution, crash recovery, safety filtering, manifest integrity, and no-overwrite guarantees. They were added around the failure modes that appeared as the system grew, not saved for one final testing pass.
