---
title: Triton Tidepool
slug: triton-tidepool
type: work
description: A local Windows research system that preserves original sources, checks generated analysis against exact evidence, and publishes searchable records to a local knowledge library.
date: "2026-08"
affiliationNotice: Triton Tidepool is an independent project by Boomer Rawlings. It is not affiliated with, endorsed by, sponsored by, or supported by UC San Diego, UC San Diego Athletics, or The Regents of the University of California.
curatorNotes:
  - "Triton Tidepool is Boomer's local research system. Papers, books, documents, recordings, and videos follow different processing paths while the original source remains preserved."
  - "A generated summary is not treated as a finished research record. A separate AI review checks its claims, then Tidepool's own code verifies quotations and page, paragraph, line, or timestamp anchors against the source."
  - "At its August 20, 2026 checkpoint, Tidepool held 71 completed research records and 611 verified active-run artifacts. Human commentary stays separate from generated notes and is never overwritten. Next, we'll look at pocketLLM."
nextExhibit:
  href: /work/pocketllm/
  label: pocketLLM
tags:
  - research systems
  - evidence provenance
  - local-first software
  - knowledge management
status: published
featured: true
---

**89 registered sources · 71 completed research records · 611 verified active-run artifacts**

Triton Tidepool is a local Windows system for turning mixed research material into a traceable knowledge library. PDFs, books, documents, recordings, and online videos retain their original structure instead of being flattened into one stream of text.

I defined the product direction, research rules, information architecture, visual system, and risk controls, then directed the implementation and review process. Tidepool is running against a real research corpus rather than a demonstration set.

## From source to research record

Each incoming file receives a SHA-256 identity before processing. A verified canonical copy is preserved, while later extraction and analysis happen in separate, versioned runs.

PDFs retain pagination. Documents retain paragraph or line references. Recordings and videos retain timestamps. Duplicate bytes resolve to one source identity even when filenames or intake routes differ.

The operating sequence is explicit:

**Capture → Preserve → Extract → Analyze → Review → Publish → Index → Verify**

A source does not enter the active research library simply because a model produced a plausible summary.

## A summary is not evidence

The first analysis pass produces claims, summaries, highlights, and source excerpts. A separate AI pass compares that work with the original material. Tidepool then checks the evidence programmatically, confirming that quotations and anchors resolve to the stated page, paragraph, line, or timestamp.

Failed review receives one correction attempt. Persistent failure blocks publication and remains visible for recovery.

These checks cannot prove that an interpretation is complete or correct. They make the system show its evidence and stop when that evidence cannot be resolved.

## Keeping responsibilities separate

Obsidian holds Source Cards, evidence notes, human commentary, and project connections. Zotero remains the bibliographic authority. Preserved originals remain separate from both.

Local search returns results with stable source and run identities plus exact source anchors. Human commentary is never overwritten. If a generated Source Card has been edited, a later run produces a proposed conflict copy instead of replacing the edited version.

External integrations are deliberately limited. Zotero reconciliation requires conservative identifier matching, a recovery snapshot, synchronization checks, and explicit authorization before any write.

## A running system

At the documented August 20, 2026 checkpoint, Tidepool held 89 registered sources, 71 completed research records, 90 preserved originals, and 611 verified active-run artifacts. Its Python suite reported 280 passing tests with one Windows permission skip, alongside passing Firefox and Zotero integration suites.

A removable-drive interruption exposed a worker failure during development. The repair added a request deadline, supervised worker recovery, and regression coverage. A live recovery check restored the service without changing the queue.

That incident reflects the larger design: failures remain visible, original material remains traceable, and completed work carries evidence of how it was produced.
