## Relationship System Plan

Building a lightweight yet flexible relationship tier (allies/neutral/hostiles) so actions focus on viable targets without overhauling the current turn pipeline.

## Module layout
- Relationship metadata: evaluate whether we can leverage existing unit tags/properties or need a separate `relationshipMap` (per-unit faction, explicit alliances, etc.).
- Relationship helper module (e.g., `relationship.ts`) that exposes `getRelationship(actor, subject)` and convenience checks like `isHostile(actor, subject)`/`isAlly(actor, subject)`.
- ActionProcessor integration point: keep existing target handling (`self`, `target`, `ally`, `enemy`, etc.) but add relationship filtering before applying effects.
- Optional world/goal integrations: let AI/goals query the helper when picking targets or scoring actions.
- Documentation stub in `Takao/agents` covering the schema and helper API so future tasks align with the same concept.

## Per-turn flow adjustments
1) Gather actor + candidate targets (current action payload or derived units).
2) Use the relationship helper to classify each candidate into ally/neutral/hostile relative to the actor.
3) For damage/attack actions, filter to hostiles only before any effect application or goal scoring.
4) For healing/support actions, restrict to allies and optionally allow self-targeting regardless of metadata.
5) Neutral interactions (trade, negotiate) can either be allowed by default or use `isNeutral` if needed.

## Testing & validation
- Unit tests for relationship helper: ensure consistent results for predetermined faction/relationship data.
- ActionProcessor tests: mock units with relationships and assert that damage actions ignore allies and heal/support only hit allies.
- Goal/evaluator tests: confirm `AttackEnemy` goals only execute when hostile targets are available.
- Documented plan in `Takao/agents/RELATIONSHIP_PLAN.md`, referencing helper API and key integration points.
