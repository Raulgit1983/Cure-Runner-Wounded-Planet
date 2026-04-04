# Audio And Rhythm Integration

## Purpose
Prepare future music and rhythm layers without coupling the game to audio assets too early.

## When To Use
- Adding beat logic
- Designing feedback loops tied to movement or collection
- Planning future soundtrack layering

## Required Checks
- Core gameplay remains fully readable with audio muted.
- Rhythm systems expose timing hooks instead of hard-coded audio assumptions.
- Emotional shifts should support added stems, pulses, or ambience layers later.
- Audio events must map to player action, progression, or discovery.

## Output Format
- Timing hook
- Trigger source
- Silent fallback behavior

## Rollback / Failure Notes
If a feature only works with sound on, rework it until the visual feedback stands on its own.
