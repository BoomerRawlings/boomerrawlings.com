---
title: Workline
slug: workline
type: work
description: A handwriting-to-feedback system that uses vision for transcription, then reserves mathematical judgment for a deterministic checker.
curatorNotes:
  - "The important split is architectural: the vision model may be uncertain, but it never grades its own transcription."
  - "The learner resolves ambiguous handwriting first. Only confirmed text reaches the deterministic math engine."
  - "The checker returns to the first transformation it cannot validate, creating a precise place to repair and continue."
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
