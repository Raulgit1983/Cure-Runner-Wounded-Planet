# Runner Juice Safe

## Purpose
Add life, fluidity, and feedback to the runner without harming fairness, readability, or frame rate.

## Trigger Conditions
- The request mentions feel, juice, bounce, motion quality, victory reactions, landings, impacts, or smoother state transitions.
- A runner interaction feels flat but the architecture should remain intact.

## Scope
- Small-scale motion polish: bounce, squash, easing, freeze frames, pop-ins, glow, and subtle camera or pose response.
- Timing-safe feel tuning that stays within the existing loop.

## Non-Scope
- Combat effects, particle-heavy spectacle, long cinematics, heavy camera systems, or core mechanic rewrites.
- Any juice that hides hitboxes, weakens telegraphing, or changes the game's identity.

## Strict Guardrails
- Prefer one clear response per event over stacked effects.
- Clamp scale and rotation changes so silhouettes stay stable on phones.
- No per-frame allocations in hot paths.
- Freeze or slow only for short reward/impact beats and never for ordinary play.
- Every audio cue must have a silent visual fallback.
- Re-tune spacing if pace changes, even slightly.

## Success Criteria
- The game feels smoother and more rewarding without becoming noisy.
- Obstacles and collectibles remain readable while moving.
- No new hitching, transform popping, or touch ambiguity appears.
- The polish is felt immediately but is hard to notice as a “system.”

## Minimal Output
- Event improved
- Safe effect used
- Fairness check
- Perf check
