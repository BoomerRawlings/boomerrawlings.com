# Workflow Display publication

- Scope: public reusable paired-workflow skill; homepage and Projects feature, demo, and complete ZIP. Existing unlisted research routes preserved.
- Source package: BoomerRawlings/Skills, release workflow-display-v1.0.0 (4f94cd8).
- Package checks: 32 Node tests and official skill validator pass. Extracted archive builds from a different working directory; no npm packages required.
- Website checks: full npm test passes, including the complete production build and existing application regressions.
- Independent usage: agent created a volunteer-team workflow with five explanation/artifact pairs, five dependencies, and a light theme using the package instructions.
- Browser: desktop pair geometry and directional dependency labels match; pointer/click tracing, locking, Escape, ArrowRight/Enter plan navigation, search empty/reset, artifact copy, and optional wrapping pass. No observed demo console warnings/errors.
- Motion: instrumented local copy records all 650ms connection pulses finishing; plan-switch animations complete. Simulated reduced-motion preference at document load produces zero transition duration, automatic scrolling, and identical plan content.
- Responsive: 320px and 390px have no page overflow; explanations remain adjacent to their artifacts; long code scrolls within its block. Phone dependency controls remain usable. Website feature also fits 390px.
- Website: feature connects demo, ZIP, and GitHub. Initial production check caught Astro inlining the prompt script against the site's CSP; a deferred same-origin script fixes copying without changing CSP. Final production preview copying and independent fallback smoke checks pass. Build verifier checks script loading, hosted metadata, embedded assets, kit contents, and public-link boundaries.
- Publication: Pages37567426372 passed for f57dfd8. Live demo and ZIP hashes match tested output; homepage, Projects feature and raw skill return200. The copy-button correction passes a fresh production build and verifier.
- Limits: inspection browser blocks file URLs; standalone portability verified structurally through embedded runtime/data. Markdown export action executes; download-event bridge timed out, so native file-save result was not inspected.
- Refresh: regenerate demo.html with the skill builder; copy to public/workflow-display/index.html while preserving its hosted canonical/description; archive the complete skill folder into public/downloads/workflow-display.zip. Run npm test before production push.
