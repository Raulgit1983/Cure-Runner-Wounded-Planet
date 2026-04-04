# Game Architecture

## Purpose
Keep the game foundation modular, testable, and scalable from the first playable slice.

## When To Use
- Planning new gameplay systems
- Adding scenes, content packs, persistence, or platform integrations
- Reviewing whether a change belongs in scene logic or a reusable system

## Required Checks
- Scene code only orchestrates input, camera, and lifecycle.
- Rules live in systems or state modules, not in one-off scene blobs.
- Content values live in config/content files.
- Persistence and backend integrations stay behind services/adapters.
- New code keeps the gameplay loop runnable offline.

## Output Format
- Decision
- Files to touch
- System boundaries
- Validation commands

## Rollback / Failure Notes
If scope starts spreading across unrelated modules, cut the slice smaller before implementation.
