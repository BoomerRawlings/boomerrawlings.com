---
title: Stars
slug: stars
publishedDate: 2026-10-19
date: "2026-10"
type: work
description: An ambient browser screensaver where drifting dots briefly resolve into audited constellation figures, with an optional clock, Scripps sky and waves, and quiet reminders.
status: published
featured: true
tags:
  - creative coding
  - astronomy
  - ambient interfaces
curatorNotes:
  - "Jump in starts the sky with constellations every 10 seconds and reminders every 5 minutes. You can adjust the pace and visible instruments in settings."
  - "The constellations use catalog positions and explicitly sourced connections. Nearby dots take on a temporary display pose while their original wandering paths keep running underneath. The lines retract before the dots drift away."
  - "Read through the three layers, then trace the ten implementation steps. Each code sample includes a note explaining how its variables contribute to the picture."
nextExhibit:
  href: /stars/
  label: Open Stars
---

[Open Stars →](/stars/)

Stars is an ambient browser display built from drifting points, recognizable constellations, and small optional instruments for time and the coast. A constellation takes shape, its name appears with a short blue-and-gold scan, and its connections later retract into the stars. The points keep wandering throughout.

## Start with the sky

The prominent **Jump in** button starts the defaults: a clock in the device's time zone, seconds, Scripps waves and astronomy, constellations every 10 seconds, and a self-care reminder every 5 minutes. Or adjust the two frequency sliders and choose the information you want. Reminders stay for 30 seconds; constellations hold for 15–20 seconds. Up to five figures can share the screen.

The clock supports 12-hour, 24-hour, or off. Seconds are one quarter of the main numeral size. The time zone follows the device unless changed. The wave panel, sunrise/sunset and moon phase are independent options. Move the pointer or tap to reveal controls; S or Esc opens settings. Choices are remembered in this browser.

## Three layers, one picture

| Layer | Code | What it contributes |
| --- | --- | --- |
| Data | `constellation-data.js` | Catalog points and connections for88 figures. |
| Animation | `constellations.js` | Particle assignment, display poses, figure timing and line retraction. |
| Scene and controls | `stars.js` + `model.js` | Canvas drawing, gentle drift, settings, time, reminders and wave data. |

A constellation is stored as normalized two-dimensional points and an array of edges. Each edge contains two indices into the point array. A single scale-and-rotation transform places the figure in the scene while retaining its proportions. The name and underline are measured as part of the same composition.

## How the motion works

Each particle has a position, direction and speed. The renderer advances it using elapsed seconds, so motion has the same pace across different refresh rates. A nearby constellation fit assigns those particles to catalog points. Their original paths continue beneath a temporary display pose.

The key interpolation in `constellations.js` is:

```js
return {
  x: p.x + (q.x - p.x) * t,
  y: p.y + (q.y - p.y) * t
};
```

Here `p` is the live particle, `q` is its target star position, and `t` is an eased blend from 0 to 1. At 0, the point follows its live path. At 1, it occupies the constellation. A smooth easing curve makes the approach feel continuous. The line drawing uses the same display coordinates, so the figure and its stars stay connected.

A separate motion-time state tracks approach, hold and release. The frequency control supplies the interval for new formations, independent of the clock's visual scan. During release, each edge becomes two segments anchored at its endpoint stars. Shortening both segments draws the connection back into the dots before they continue across the scene.

## Small instruments

Clock formatting uses the browser's `Intl.DateTimeFormat` with the selected time zone. A shared settings model supplies both the form values and the renderer, keeping each panel independent.

The reminder scheduler converts local time into minutes since midnight. `minute % interval` gives progress through a reminder cycle; `Math.floor(minute / 5)` selects one of 288 time-aware messages. Its first 30 seconds form the visible portion of the cycle.

SunCalc supplies sunrise, sunset, moon transit and phase at Scripps Pier in San Diego. Daytime shows sunset and its countdown. At night, the moon phase remains visible as the countdown moves from moon peak to sunrise. The chosen timezone controls the written event times.

The waves panel uses Open-Meteo's offshore model near Scripps Pier. Its height arrives in metres and is converted to feet; height also informs the animated wave. The label distinguishes this estimate from breaking surf height.

## Explore the code

The complete ten-step walkthrough is below. Each explanation sits beside its actual data or implementation, with notes explaining the important variables and functions. Select a heading to follow its connections to related steps.

<iframe data-stars-workflow src="/stars-assets/workflow.html?embed=1" title="Full Stars development workflow with paired explanations and artifacts" loading="lazy" style="display:block;width:100%;height:780px;border:1px solid #3c505c;background:#080e13"></iframe>

<script src="/stars-assets/workflow-embed.js" defer></script>

[Workflow full size](/stars-assets/workflow.html) · [Editable workflow JSON](/stars-assets/workflow.json)

## Data and source

The figure database contains 88 audited constellations, 747 unique catalog stars and 753 connections. Each point and edge records its published figure source. These are recognizable line figures rather than a live map of the sky overhead.

[Figure data](/stars-assets/constellations.json) · [Constellation animation](/stars-assets/constellations.js) · [Browser renderer](/stars-assets/stars.js) · [Settings and timing](/stars-assets/model.js) · [Credits and licenses](/stars-assets/credits.txt)

<a href="/downloads/stars-wallpaper-engine.zip" download>Wallpaper Engine download (.zip)</a>
