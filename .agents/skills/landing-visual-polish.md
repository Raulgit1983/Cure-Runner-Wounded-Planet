# Landing Visual Polish

## Purpose
Polish the first screen without redesigning the game or diluting Mateo's planet-led identity.

## Trigger Conditions
- The request mentions landing, intro, hero section, first impression, CTA readability, or focal asset presentation.
- A key art asset needs cleaner alpha integration, larger focus, safer spacing, or lighter motion on mobile.

## Scope
- Entry composition, focal asset sizing, hierarchy, CTA placement, safe-area spacing, and alpha-safe presentation.
- One or two lightweight motions such as drift, pulse, or glow fluctuation.

## Non-Scope
- New narrative systems, broad palette changes, full UI redesigns, heavy animation, or new dependencies.
- Repainting core art or replacing Mateo's source drawing logic.

## Strict Guardrails
- Inspect only the active entry files, current focal asset, and one adjacent style/config file first.
- Mobile portrait is the reference layout; 360x640 must read cleanly.
- Preserve hand-drawn asymmetry; avoid glossy app-store polish.
- No visible matte, white box, or alpha fringe around focal assets.
- Use at most two cheap motions and no particles/shaders.
- Prefer spacing, scale, contrast, and layering fixes before new decoration.

## Success Criteria
- The focal asset is obvious within one second on a phone.
- CTA and mission copy remain readable without crowding.
- Asset edges stay clean on the real background.
- The change adds no dependency and no noticeable load/perf cost.

## Minimal Output
- Focal point
- Files touched
- Readability check
- Perf risk
