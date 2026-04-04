# Project Constitution

## Purpose
Build an original mobile-first web game for Mateo that feels hand-crafted, emotionally subtle, performant, and scalable.

## Non-Negotiables
- Originality: borrow no direct mechanics, pacing, level flow, or visual language from existing games.
- Mobile performance: optimize for real phones first; keep input responsive, frame work light, and asset sizes disciplined.
- Modular architecture: scenes orchestrate, systems own mechanics, content/config stays data-driven, persistence stays isolated.
- Emotional tone: express sadness-to-aliveness through play, rhythm, posture, responsiveness, color, and audio layers, not exposition.
- Visual identity: preserve the hero's asymmetry, innocence, readability, and hand-drawn character over generic polish.
- Backend boundary: gameplay must run without Firebase; all cloud work stays behind adapters/services.
- Low-waste AI usage: request the smallest useful slice, make the smallest reviewable change, validate before closing.
- Incremental delivery: prefer stable vertical slices over speculative frameworks.

## Slice Gate
- State the decision, scope, and files touched.
- Run validation before closure.
- Note any residual risk or deferred work.

## Validation Gate
- `npm run check`
- `npm run build`
- Local dev sanity on `0.0.0.0:4321`

## Forbidden
- Cloning known games.
- Large logic blobs inside scenes or UI components.
- Backend-coupled gameplay rules.
- Generic glossy art direction that weakens the hero's identity.
- Closing work without a runnable verification step.
