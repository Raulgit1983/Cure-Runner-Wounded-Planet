# Mobile Readability Audit

## Purpose
Catch and fix the small-screen problems that make the game feel unfair, crowded, or visually muddy.

## Trigger Conditions
- The request mentions readability, clutter, overlap, visibility, HUD weight, mobile portrait fit, or phone fairness.
- A panel, obstacle, collectible arc, or landing layout feels hard to read on a real phone.

## Scope
- HUD footprint, look-ahead space, text fit, contrast, hitbox/readability alignment, safe area, and reward/panel composition.
- Quick audits of 360x640 behavior before broader polish.

## Non-Scope
- Full visual redesigns, tablet-first layouts, or desktop-centric polish.
- Non-visible architecture refactors unless the readability issue truly cannot be fixed locally.

## Strict Guardrails
- Start with the smallest screen that matters, then scale up.
- Prioritize what the player must notice next within the next second of play.
- Trim UI before shrinking text.
- Keep line lengths short and hierarchy obvious.
- Visible form and collision expectations must roughly match.
- Fix one readability problem at a time; do not open unrelated polish fronts.

## Success Criteria
- The next hazard/reward is readable ahead of the hero.
- Critical copy fits without overlap on mobile portrait.
- HUD stays secondary to gameplay.
- The fix improves clarity without adding clutter.

## Minimal Output
- Readability issue
- Screen-size check
- Change made
- Residual risk
