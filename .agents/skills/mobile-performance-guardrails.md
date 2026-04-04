# Mobile Performance Guardrails

## Purpose
Protect frame rate, battery, readability, and touch responsiveness on real phones.

## When To Use
- Before adding visuals, particles, shaders, audio, or new UI overlays
- During scene implementation or performance review

## Required Checks
- Default to a 360x640 logical playfield and scale outward.
- Keep textures lean; resize oversized source assets before runtime use.
- Avoid per-frame allocations in hot paths.
- Redraw expensive graphics only when visible state meaningfully changes.
- Prefer one clear effect over many weak effects.
- Touch targets and HUD text must stay readable on small screens.

## Output Format
- Risk summary
- Budget-sensitive changes
- Validation method on mobile viewport

## Rollback / Failure Notes
If a visual effect hurts responsiveness, remove it before tuning secondary polish.
