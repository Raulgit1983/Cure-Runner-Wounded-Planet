# Safe Child Static Web

## Purpose
Keep the public build as close as practical to a zero-data, child-safe static site on GitHub Pages.

## Trigger Conditions
- The request mentions publish, public build, GitHub Pages, security, privacy, child-safe review, CSP, trackers, telemetry, or Firebase exposure.
- Any new feature risks adding remote calls, exposed debug state, or unnecessary player data storage.

## Scope
- Static-site hardening, client privacy review, debug gating, CSP/referrer posture, same-origin-only asset loading, and Pages compatibility.
- Verifying what the public build actually ships.

## Non-Scope
- Backend auth systems, server headers unavailable on GitHub Pages, or secret rotation outside the repo.
- Collecting user data “safely.” The default is no collection.

## Strict Guardrails
- No analytics, ads, chat, forms, social features, or third-party embeds in the child-facing build.
- No remote calls unless gameplay truly requires them; default to same-origin static assets only.
- Expose debug globals only in explicit debug mode.
- Keep Firebase behind adapters and unused in public gameplay unless explicitly required.
- Add the safest practical CSP/referrer policy that still works with the shipped static app.
- Report Pages limitations plainly instead of pretending they do not exist.

## Success Criteria
- The public build makes no nonessential external calls.
- No secrets, admin credentials, or private endpoints are exposed.
- Debug-only surfaces are gated out of normal play.
- GitHub Pages deployment still works after hardening.

## Minimal Output
- Data collection status
- External call status
- Hardening changes
- Remaining static-hosting limits
