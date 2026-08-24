---
title: Migrating and Indexing 31,550 Photos and Videos
slug: organizing-icloud-media
type: work
description: An actively supervised migration and frame-level indexing system for 31,550 iCloud photos and videos.
curatorNotes:
  - "31,550 items is only the visible scale. No single available tool handled this library’s full export workflow, so fidelity depends on a supervised migration—not a bulk-download button."
  - "Media moves through staged batches, checks, reconciliation, and logs; active supervision exposes failures before files enter the local library."
  - "Then the scale multiplies: a separate parser tags each photo and every video frame while keeping derived records apart from—and traceable to—the source media."
nextExhibit:
  href: /work/interactive-systems/
  label: Interactive Systems
tags:
  - media organization
  - media preservation
  - data organization
status: published
featured: true
---

This project builds a checked local library from a 31,550-item iCloud collection. No single available tool handled the transfer, validation, organization, and indexing workflow end to end.

Media moves through staged batches, file checks, reconciliation, and promotion logs before entering the organized library. The cloud source and preserved original files are treated as read-only. Maintaining fidelity is not a one-time export; it requires continued monitoring and repair rather than trust in one unattended run.

A separate parsing layer generates searchable text and tags for each photo and every frame of every video. These derivative records remain apart from the originals; source references and processing provenance connect each observation back to its media file.
