---
name: trc-asset-production
description: Produce TRC marketing copy, image prompts, video scripts, storyboards, and animation handoffs from an approved campaign angle. Use with Claude Code, Gemini, or other generation tools without assuming API availability.
---

# TRC asset production

Paths are repository-root relative. Read `AGENTS.md`, `marketing/README.md`,
the three brand documents, and the selected brief. Use
`marketing/templates/production-record.json` for the production handoff.
Adapt `marketing/templates/creative-prompts.md` for copy, keyframes, animation,
and editing handoffs. Replace placeholders before supplying prompts to a tool.

## Before generating

Confirm the angle, audience, CTA, language, placement, asset type, available
references, and spend authorization. If these are missing, prepare draft copy or
prompts with visible unknowns; do not call paid generation tools.

The owner accepts any suitable medium. Recommend a concrete format based on the
message and workload, rather than asking them to make every production choice.
Founder appearance is case by case, never a hero/status narrative by default.

Inspect the selected tool's actual capabilities and current documentation before
using an API. Do not assume that "Nano Banana" identifies a specific version or
that a tool supports seeds, negative prompts, reference images, or animation.
Do not install dependencies or add external integrations just to prepare prompts.

## Production procedure

1. Use stable campaign/asset IDs. Create a production record per asset/version
   or a named collection of equivalent records. Capture the exact model/version,
   prompts, references actually supplied, settings, output location, and known cost.
2. Draft the copy first: hook, body/script, on-screen text, caption, and CTA.
   Use evidence IDs for facts. Include disclosure where applicable.
3. Build the visual prompt with purpose, subject, setting, composition,
   lighting, palette, reference IDs, crop/safe-space needs, and exclusions.
   Keep exact logos and typography for finishing rather than asking the generator
   to recreate them.
4. For video, make a timed shot list with narrative purpose, visual, voiceover,
   on-screen copy, camera/motion, continuity, and evidence IDs. Select and approve
   keyframes before animation. Do not generate unrelated shots without a plan.
5. Produce only authorized variants. Change one meaningful variable when testing
   a hypothesis. Record rejected runs and useful failure notes without endless
   regeneration or inventing reproducibility guarantees.
6. Finish in a controlled editing/layout step: approved logo master, exact fonts,
   captions, CTA, disclosures, licensed audio, and authentic sourced screenshots.
   Generated people and campuses are never evidence or student endorsements.
7. Preserve editable sources and versioned exports. Record rights and appropriate
   permissions, but do not copy contracts, personal documents, or private contact
   data into this repository or third-party generation tools.
8. Supply a text description/alt text where applicable. Check phone readability,
   contrast, caption timing, and current placement dimensions and safe areas.

## Handoff

Return copy, prompt files, storyboard where relevant, production-record location,
actual output locations if generated, and unresolved issues. Distinguish
`prompt_prepared`, `generated`, and `export_reviewed`; never imply an unseen
output was inspected.

Use `.devin/skills/trc-creative-qa/SKILL.md` for review. Generation, QA, owner
approval, publication, and spend approval are separate stages. Do not publish
or use private student material without specific authorization.
