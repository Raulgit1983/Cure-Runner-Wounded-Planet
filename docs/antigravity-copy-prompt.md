# Cure Runner — Copy Session Prompt

> Reusable master prompt for any future Antigravity session that touches copy in this project.
> Paste this as context or reference `docs/copy-doctrine.md` directly.

---

## System Context

You are working on **Cure Runner: Wounded Planet**, a mobile-first web game for a perceptive 12-year-old named Mateo.

This is a companion experience designed to accompany, not patronize; educate without preaching; and nurture agency, curiosity, resilience, and emotional depth.

## Required Reading

1. `/docs/copy-doctrine.md` — the master editorial architecture
2. `/docs/copy-rules-quick.md` — the operational checklist
3. `/docs/copy-lexicon.md` — vocabulary and phrase bank
4. `/docs/copy-review-rubric.md` — scoring system

## Core Constraints

- **Player:** Detects dishonesty, condescension, and hollow praise instantly.
- **Language:** Spanish. Cultural expressions are preserved when authentic, legible, meaningful, and purposeful (e.g. "Ñó!!!").
- **Platform:** Mobile-first. Max ~35 characters per line. HUD hints ≤ 5 words. CTAs ≤ 3 words.
- **Decision hierarchy:** Silence → Clarity → Warmth → Poetry.

## Copy Must Never

- Evaluate the player ("¡Bien hecho!", "¡Eres increíble!")
- Explain emotions ("No tengas miedo")
- Use self-help clichés ("Cree en ti", "Todo estará bien")
- Moralize, preach, shame, or use fear language
- Use poetry where mechanics need clarity

## Copy Must Always

- Observe the world, not judge the player ("Algo ha despertado" vs "¡Lo lograste!")
- Acknowledge process, not outcome ("Sigue subiendo" vs "Ganaste")
- Invite, not command ("Toca para volver" vs "¡Inténtalo!")
- Survive 200 readings without feeling hollow
- Anchor symbolic language to visible game mechanics

## Working Process

1. Identify the copy context (use taxonomy codes from doctrine §11).
2. Draft the line.
3. Score it against `/docs/copy-review-rubric.md` (minimum 3.0 average, Clarity ≥ 3).
4. Check all anti-patterns (doctrine §8).
5. Verify mobile constraints.
6. If developing a feature fast without copy review, use **[BRACKETED LITERALS]** (e.g., `[SHARK HEALS]`) per doctrine §13.

## Repo Copy Locations

| File | Contains |
|------|----------|
| `src/main.ts` | Title, loading, entry flow, error recovery |
| `src/game/scenes/JourneyScene.ts` | Victory, failure, continue, guidance, shark lines, hit reactions |
| `src/game/scenes/BootScene.ts` | Loading/boot text, error text |
| `src/ui/createHud.ts` | HUD labels, HUD hints, mechanic copy |
| `src/game/content/heroProfile.ts` | Hero identity notes |
| `src/game/content/runnerPhrases.ts` | Phrase structure labels |
