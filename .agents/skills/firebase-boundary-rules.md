# Firebase Boundary Rules

## Purpose
Keep Firebase useful but fully decoupled from the core gameplay loop.

## When To Use
- Adding save sync, analytics, remote config, or player identity features
- Reviewing architecture for backend creep

## Required Checks
- Gameplay state updates cannot depend on network round trips.
- Firebase calls live behind adapter interfaces in services.
- Scenes never import Firebase SDKs directly.
- Local persistence remains the source of truth during play.
- Failures degrade gracefully and never block touch input or frame flow.

## Output Format
- Adapter touched
- Offline behavior
- Failure handling

## Rollback / Failure Notes
If gameplay starts depending on Firebase availability, stop and move the boundary back behind a service.
