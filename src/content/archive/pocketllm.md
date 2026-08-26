---
title: pocketLLM
slug: pocketllm
date: "2026-08"
type: work
description: A local Windows tool that creates reversible pseudonymized working copies of supported text files while leaving originals unchanged.
visualEvidence:
  - role: proof
    kind: video
    src: /media/projects/pocketllm/interface-tour.mp4
    poster: /media/projects/pocketllm/interface-tour-poster.webp
    alt: pocketLLM starts empty, receives two synthetic files by drag and drop, encodes them locally, reacts when its face is clicked, then recognizes the coded files and matching keys and restores new copies.
    caption: "A fresh-launch demonstration: drag in two synthetic files, create reversible coded copies locally, click the face, restart, then drag the coded files back to match their keys and restore them."
    width: 1080
    height: 1440
curatorNotes:
  - "pocketLLM makes reversible, pseudonymized working copies locally while leaving the original files untouched."
  - "This starts from a fresh launch. Boomer drags in two synthetic files, encodes them, and clicks the face while the work finishes. It answers, 'Oh! I'm not a touch screen!'"
  - "After restarting, he drags the coded files back in. pocketLLM finds their matching keys and creates restored copies. Every result still needs human review because automated detection can miss identifiers. Next, we'll look at tools for working with sources."
nextExhibit:
  href: /work/research-publishing-systems/
  label: Research and Publishing Systems
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
