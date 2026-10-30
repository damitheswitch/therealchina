---
name: trc-creative-qa
description: Review TRC campaign copy, generated images, videos, captions, and destinations for brand consistency, evidence, commercial disclosures, privacy, accessibility, and publication readiness.
---

# TRC creative QA

Paths are repository-root relative. Read `AGENTS.md`, `marketing/README.md`,
the brand documents, campaign brief, and production record. Use
`marketing/templates/review-checklist.md` for the campaign's `qa.md`.

## Review procedure

1. Identify the exact asset versions, captions, destinations, and placements.
   Inspect the actual exports, not just prompts or descriptions. If tooling
   cannot inspect the image, play the video/audio, or test the destination,
   report `not_verified` and request human review. Never mark unseen media passed.
2. Check one audience/action, clear value, truthful copy, and brand voice.
   Check the logo master, palette, typography, and phone readability.
3. Trace factual claims to evidence IDs and current sources. Flag unsupported
   counts, prices, guarantees, verification claims, rewards, and testimonials.
4. For real people, student stories, campus media, screenshots, music, and voices,
   check source, rights, privacy, and intended use. Synthetic scenes cannot pass
   as genuine student experience or documentary campus footage.
5. Review every video shot for continuity, strange motion, flicker, text defects,
   caption/voice timing, and disclosure visibility. Still-image QA alone is not
   video QA. If full playback is unavailable, leave this check unverified.
6. For commercial assets, require partner due diligence, accurate terms, visible
   disclosure in each relevant placement, and public-policy alignment.
   Admissions-on-hold and policy conflicts block publication.
7. Check current placement requirements, destination behavior on intended
   device/network, group permissions, measurement limits, and budget boundaries.
8. Record each finding with severity, asset/timecode, evidence, and required fix.
   Use `blocked` for missing proof, permissions, commercial clearance, or required
   inspection; `changes_needed` for fixable creative defects; otherwise
   `ready_for_owner_review`. Do not issue an automatic publication approval.

## Handoff

Return the verdict, blockers first, concrete fixes, and checks not performed.
Record reviewer/date and exact versions. If saving is authorized, update `qa.md`
and the production record without overwriting the owner's approval fields.

Owner approval must cover the exact export, caption, destination, and placement.
Publishing, messaging, and spending still need separate explicit authorization.
Do not launch a second agent for review unless the user requests agents.
