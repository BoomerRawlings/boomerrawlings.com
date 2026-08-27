---
title: Research Briefing Assistant
slug: research-briefing-assistant
type: work
description: An open Codex skill for dual-pass research briefings, with claim-level evidence reconciliation and machine-checkable package gates.
date: "2026-08"
projectStage: Work in progress
curatorNotes:
  - "This project asks a useful question: what should happen before a polished research briefing is trusted?"
  - "The workflow keeps ChatGPT and Gemini research passes separate until both are saved and hashed. It then compares claims, sources, and disagreements instead of smoothing them into one answer."
  - "A Python validator checks selected parts of the final package, including missing files, pass timing, score drift, and required handoff fields. Human review still decides whether the research itself is sound. The media pipeline is next."
nextExhibit:
  href: /work/organizing-icloud-media/
  label: iCloud Media Migration and Catalog
tags:
  - research methods
  - evidence evaluation
  - quality assurance
  - Codex skills
status: published
featured: true
---

> Work in progress. The public repository contains the workflow, reference specifications, and a package validator. It does not replace substantive review of the research.

The Research Briefing Assistant is designed for questions where a polished answer is not enough. It preserves two independent research passes, traces disagreements back to their sources, and keeps the final judgment separate from confidence in that judgment.

## Keeping the research passes independent

The workflow begins with a shared research charter. ChatGPT completes and saves one pass before Gemini begins its own. Both are hashed and timestamped before either system can see the other's conclusions or scores.

This does not make either pass correct. It creates a record of where they agreed independently, where they disagreed, and what changed after comparison.

## Reconciling claims instead of summaries

The two passes are compared at the claim and source-family level. Differences can be traced to definitions, methods, samples, dates, assumptions, or overlapping citations. Merit and confidence are scored separately so a promising result is not automatically treated as a stable one.

## Checking the handoff

The repository includes a standard-library Python validator for selected package checks. It can identify missing deliverables, malformed manifests, broken pass-timing evidence, score drift, and incomplete handoff fields.

The validator cannot decide whether a paper was interpreted correctly, whether the evidence base is complete, or whether generated briefing media is balanced. Those remain human-review questions.

[View project on GitHub](https://github.com/BoomerRawlings/research-briefing-assistant)
