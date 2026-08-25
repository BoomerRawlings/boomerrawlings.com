---
title: pocketLLM
slug: pocketllm
type: work
description: A local Windows tool that creates reversible pseudonymized working copies of supported text files while leaving originals unchanged.
visualEvidence:
  - role: proof
    kind: video
    src: /media/projects/pocketllm/interface-tour.mp4
    poster: /media/projects/pocketllm/interface-tour-poster.webp
    alt: pocketLLM processing two synthetic text files while its on-screen face reacts, then displaying the completed working-copy and key-file results.
    caption: A synthetic two-file demonstration moves from input selection and local processing to reversible working copies and matching key files.
    width: 960
    height: 1278
curatorNotes:
  - "pocketLLM creates pseudonymized working copies while leaving the original text files unchanged."
  - "The video uses synthetic files, and yes, the little face objects when the cursor clicks it! Behind that moment, likely identifiers are replaced locally and recorded in matching key files."
  - "Those keys make restoration possible, but detection can miss things, so every copy still needs human review. Workline is next."
nextExhibit:
  href: /work/workline/
  label: Workline
tags:
  - privacy tools
  - local software
  - reversible pseudonymization
status: published
featured: true
---

pocketLLM creates pseudonymized working copies of TXT, MD, CSV, TSV, and JSONL files on Windows. Each new file uses `_pllm` in its name while the source file remains unchanged.

Presidio and spaCy identify likely personal names and other identifiers for replacement. A matching `.pocketkey` records what is needed to reverse those substitutions and restore the coded details.

Automated detection can miss identifiers, so every working copy still requires review. pocketLLM is a practical local processing tool, not a compliance certification.
