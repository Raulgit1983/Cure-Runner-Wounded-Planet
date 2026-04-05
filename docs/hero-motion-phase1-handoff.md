# Hero Motion Phase 1 Handoff

Approved scope only. Do not treat this as Phase 2 planning.

## Approved Pose Set

- Base/default pose: `hero-main` using `hero-main.webp`
- Hit pose: `hero-hit-stagger` using `hero-hit-stagger.webp`
- Air rise pose: `hero-jump-rise` using `hero-jump-rise.webp`
- Air fall pose: `hero-jump-fall` using `hero-jump-fall.webp`

## Alignment Rule

- `hero-main` stays the base texture and fallback/default pose.
- All Phase 1 pose art must align to the current hero anchor and render with the existing origin: `(0.5, 0.58)`.
- Do not add per-pose origin overrides or special offsets.
- Keep the current procedural position, scale, rotation, aura, and shadow motion intact; only swap the hero texture on the existing `hero` image.

## Switching Logic

Implement pose switching in `JourneyScene.ts` only, on the existing hero object.

Priority order:

1. If a hit-pose lock is active, use `hero-hit-stagger`.
2. Else if the hero is airborne and `velocityY` is below a negative rise threshold, use `hero-jump-rise`.
3. Else if the hero is airborne and `velocityY` is above a positive fall threshold, use `hero-jump-fall`.
4. Else if the hero is airborne inside the apex deadzone, keep the previous airborne pose to avoid flicker.
5. Else use `hero-main`.

Notes:

- Use a small deadzone / hysteresis around `velocityY === 0`; do not flip poses exactly at zero.
- Grounded state always resolves back to `hero-main` once no hit lock is active.
- This is a pose-swap hybrid system, not a replacement of the current procedural motion.

## Hit-Pose Lock

- Trigger the hit pose from the same JourneyScene-side hit moment already used for the hit reaction flow.
- Hold `hero-hit-stagger` briefly for about `150ms`.
- While the lock is active, it overrides jump-rise / jump-fall switching.

## Files To Change Later

- `src/assets/hero/`
  Add `hero-hit-stagger.webp`, `hero-jump-rise.webp`, and `hero-jump-fall.webp`.
- `src/game/scenes/BootScene.ts`
  Import and load the new hero pose assets through the existing image asset pipeline.
- `src/game/scenes/JourneyScene.ts`
  Add pose texture keys, hit-lock state/timer, and the deadzone / hysteresis-based texture switching.

## Explicitly Deferred To Phase 2

- Any new hero poses beyond the three approved Phase 1 additions.
- Any authored run cycle, idle cycle, landing-specific pose, double-jump-specific pose, or cinematic/victory/failure pose set.
- Any change to gameplay code, hitboxes, physics, runner timing, or `RunnerLoopSystem` behavior.
- Any refactor that moves pose switching out of `JourneyScene.ts` or replaces the current procedural motion system.
