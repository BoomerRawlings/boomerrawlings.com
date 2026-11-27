# Do I Understand?

**v0.1 · An experimental skill for Codex and Claude Code**

A fluent AI explanation can feel like understanding. This skill pauses the explanation and asks you to do two things: explain the mechanism in your own words, then predict what happens when one important condition changes. It reports the evidence and the gaps without pretending to certify mastery or originality.

## Install in one project

Copy [SKILL.md](SKILL.md) into one of these locations, creating the folders as needed:

| Client | Path relative to your project root | Try |
| --- | --- | --- |
| [Codex](https://developers.openai.com/codex/skills) | `.agents/skills/do-i-understand/SKILL.md` | `$do-i-understand Check my understanding of this design decision.` |
| [Claude Code](https://code.claude.com/docs/en/skills) | `.claude/skills/do-i-understand/SKILL.md` | `/do-i-understand Check my understanding of this design decision.` |

Open the client in that project. If the newly added skill is missing, reopen the session. No dependencies or setup scripts. To try the idea without installing, paste the file's instructions into a fresh chat.

## Help test it

Use something you recently learned or built with AI. Before starting, privately predict what you can explain and what might trip you up. Then do the two prompts before looking anything up. Try the same protocol on a comparable topic in a second client; don't reuse a question you've already seen.

Record four things: whether the first prompt leaked the answer, whether the new example changed something meaningful, whether the assessment was supported by your answer, and whether it surfaced a gap you didn't predict. Include the client/model and whether you used hints if reporting a result. Please don't post private code, transcripts, or study material.

This is a prototype, not a validated measurement instrument. The skill itself does not store or transmit results; your client's ordinary conversation handling still applies.

[Public project page](https://boomerrawlings.com/do-i-understand/)

## Quick behavior checks

- **Code:** Test why a cache key includes the locale. A useful fresh case can change what the cached result depends on, not just the locale string.
- **Study:** Test why random assignment helps causal inference. A useful fresh case can change when participants drop out, not just rename the groups.
- **Assisted attempt:** Ask for a hint before answering. The summary should distinguish what you knew before the hint from what the hint supplied.
- **Lucky guess:** Give a correct prediction with an incorrect reason. The summary should credit the prediction without crediting the reasoning.

These are suggested manual checks, not claims that either client has passed them.
