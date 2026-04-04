# Character Consistency

## Purpose
Preserve the current hero as the canonical identity while converting the drawing into production-safe rules.

## When To Use
- Adding animation states
- Cropping portraits or icons
- Adjusting scale, pose, VFX, or emotional expression

## Required Checks
- Silhouette: the round pink body remains the dominant read, with the drooping left-side taper intact.
- Face anchors: one oversized green eye, one X eye, and the curved sad mouth must remain instantly readable.
- Horn identity: black outer horns with green interior stay visible against the background.
- Mobile scale: full-body readability target is 88px to 160px tall; below that, switch to face-first crops.
- Small-screen support: keep a clean rim light or shadow behind the hero when backgrounds get busy.
- Animation viability: use subtle squash, tilt, bob, blink, and limb accents; do not distort the head mass or horn placement.
- UI/icon friendliness: icon crops should prioritize horns, both eyes, and mouth; minimum icon size is 40px.
- State variation: sadness evolves through posture lift, eye brightness, pulse aura, timing, and responsiveness, not through redesign.
- Identity lock: the X eye, green eye, horn colors, pink body mass, and cute-weird asymmetry never change.

## Output Format
- What stays fixed
- What may change
- Readability check
- Emotion-state notes

## Rollback / Failure Notes
If a pose or crop loses the eye contrast, horn read, or mouth shape, revert to the last readable version.
