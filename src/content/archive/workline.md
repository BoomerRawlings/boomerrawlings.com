---
title: Workline
slug: workline
type: work
description: A handwriting-to-feedback system that uses vision for transcription, then reserves mathematical judgment for a deterministic checker.
date: "2026-08"
visualEvidence:
  - role: process
    kind: image
    src: /media/projects/workline/handwriting-feedback-pipeline.svg
    alt: Workline flow from a handwritten math photo through learner-confirmed transcription to deterministic checking and revision.
    caption: Workline separates reading from judgment. AI transcribes the page, the learner confirms the text, and a deterministic checker identifies the first step that needs revision.
    width: 1600
    height: 900
curatorNotes:
  - "The diagram starts with a photograph of handwritten math and ends with feedback a learner can actually use."
  - "The vision model reads the page and marks uncertain text. The learner confirms it before a separate, deterministic checker evaluates the math."
  - "If a step fails, the checker points to the first break so the learner knows where to restart. Now let's look at the publishing systems behind finished documents."
nextExhibit:
  href: /work/research-publishing-systems/
  label: Research and Publishing Systems
tags:
  - learning tools
  - computer vision
  - deterministic systems
status: published
featured: true
---

Workline turns a photograph of handwritten linear-equation work into targeted feedback without asking one probabilistic model to both read and judge the page.

A vision model transcribes the work into ordered steps and marks uncertain text. The learner confirms or edits that transcription before it enters the deterministic math engine. Only confirmed text is evaluated.

The checker returns to the first transformation it cannot validate, giving the learner an exact point from which to revise and retry. This focused pipeline grew from a broader paper-first practice system built around diagnosis, repair sets, and later review.
