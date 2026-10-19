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
  - "Stars is meant to become quiet after you set it up. Choose what belongs on your screen, then let the settings disappear. Move your pointer or press S to bring them back."
  - "The constellations use catalog positions and explicitly sourced connections. Nearby dots take on a temporary display pose while their original wandering paths keep running underneath. The lines retract before the dots drift away."
  - "The walkthrough below pairs each development decision with its actual artifact. The Scripps panels are optional: changing the display time zone does not move the sun, moon, or wave forecast to another location."
nextExhibit:
  href: /stars/
  label: Open Stars
---

[Configure and enter Stars →](/stars/)

Stars turns a browser window into a quiet ambient display. Small points drift and make passing connections. Occasionally, a nearby arrangement resolves into one of 88 named constellation figures. A directional blue-and-gold glitch marks the lock; the name and a single underline appear together. After 15–20 readable seconds, the lines draw back into their endpoint stars and the wandering resumes.

## Choose your screen

The [settings screen](/stars/) offers a 12-hour clock, a 24-hour clock, or no clock; optional quarter-size seconds; and a time zone that follows the device unless changed. Scripps offshore waves and sunrise, sunset, and moon phase can be enabled independently. A reminder slider selects every 5, 10, 15, 20, 30, or 60 minutes, or disabled. Each reminder lasts 30 seconds and works even with the clock removed. A separate constellation slider targets a new lock every 10–60 seconds, defaulting to 10. Dots gather before the first lock; poor fits or crowded layouts can delay or skip a formation.

Confirming settings clears the interface. Controls fade after inactivity and return with pointer movement, a tap, or keyboard interaction. Press S or Esc to change settings. Fullscreen is optional; a supported browser can keep the screen awake while the page is visible. Preferences are stored only in that browser.

## The movement behind the picture

The points retain their own continuously running positions and headings. A fitting pass assigns nearby, unclaimed points to a rigid constellation shape. Only the display pose changes: the underlying paths continue throughout the lock. Connections stay hidden during the approach, so a complete figure does not sit waiting for its name. After the exit sweep and line retraction, display positions gradually converge with the live paths.

The selected interval controls the pace of new locks. Five is the safety cap, including gathering and departing figures. Poor fits are skipped. Prominent northern figures, zodiac constellations, and mythological figures receive more weight; two- and three-star figures remain possible but much rarer. Recent selections have a cooldown. These are illustrative figures, not a live map of the sky overhead.

The full figure, label, and underline must fit onscreen and avoid the clock, reminders, sky/wave panel, and other figures. Unrelated points inside a locked figure are strongly dimmed; ambient connections crossing it disappear until it releases. Smaller screens may offer fewer safe opportunities.

## Time, sky, and water

Sun and moon calculations use Scripps Pier in San Diego. Daytime shows sunset and the remaining time. At night, the phase stays visible while the countdown follows that night's moon peak, then sunrise. Major transitions wait for the next shared glitch. The time-zone setting changes how event times are written, not the location of those events.

The waves panel fetches an Open-Meteo offshore model estimate after it is enabled. It displays wave height and period, explicitly distinguished from breaking surf height. It refreshes while visible; stale or unavailable data is shown as unavailable. Disabling waves prevents further forecast requests. No microphone or geolocation permission is requested. The operating system's reduced-motion setting freezes the ambient movement and removes glitch animation.

## Development, with the artifacts

This is a curated walkthrough of the actual work, not a verbatim chat transcript or a claim about development hours. All ten steps appear below, from the figure database through the browser display. Each explanation stays paired with its data, decision, or code; select a heading to inspect its dependencies.

<iframe data-stars-workflow src="/stars-assets/workflow.html?embed=1" title="Full Stars development workflow with paired explanations and artifacts" loading="lazy" style="display:block;width:100%;height:780px;border:1px solid #3c505c;background:#080e13"></iframe>

<script src="/stars-assets/workflow-embed.js" defer></script>

[Open the workflow full size](/stars-assets/workflow.html) · [Editable workflow JSON](/stars-assets/workflow.json)

## Sources and inspectable code

The figure database has 88 audited entries, with 747 unique catalog stars and 753 explicitly sourced connections. Constellation boundaries and recognizable stick figures are different things: the IAU defines sky regions, while line traditions vary. The database records which published figure supplied each star and segment; surrounding chart stars are not silently added.

[Figure database and provenance](/stars-assets/constellations.json) · [Motion and fitting source](/stars-assets/constellations.js) · [Browser renderer](/stars-assets/stars.js) · [Settings and timing logic](/stars-assets/model.js) · [Source credits and licenses](/stars-assets/credits.txt)

Astronomical calculations use SunCalc. The figure sources, catalog credits, and retained license notices are listed separately. The browser renderer and configuration logic are published as inspectable source alongside the display.
