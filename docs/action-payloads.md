# Action Payload Structure

This document summarizes how action payloads are defined, expanded, and enriched at runtime in the Takao engine.

## Definition and sources
- Base type: `ActionPayload` (`src/types/index.ts`) is a loose record of string keys to primitive values or objects.
- Data source: Actions in `data/actions.json` supply payload templates (e.g. `range`, `direction`, resource amounts).
- Runtime expansion: `ActionProcessor.processActionPayload` (`src/utils/ActionProcessor.ts`) normalizes special payload shapes before execution.

## Payload value expansion rules
- `{"type":"random","min":number,"max":number}` → replaced with a number in the range.
- `{"type":"random_direction"}` → replaced with one of `north|south|east|west|northeast|northwest|southeast|southwest`.
- `{"type":"random_resource"}` → replaced with one of `gold|wood|stone|food|herbs|ore`.
- `{"type":"calculated","base":string,"modifier":number}` → if the target unit has the `base` property, use `base + modifier`; otherwise uses the modifier alone.
- Other keys pass through unchanged (e.g. simple `range`, `direction`, identifiers).

## Effect value usage (modifyProperty – preferred)
`modifyProperty` bundles the target property and the numeric delta in a single value spec:
- Shape: `{ "type": "modifyProperty", "key": "<propertyName>", "value": <number or value spec> }`
- The nested `value` can be a number, `random`, or `calculated`.
- The `key` overrides `effect.property` when applying the effect.

## StoryTeller enrichments
When building an `ExecutedAction`, `StoryTeller` (`src/core/StoryTeller.ts`) layers contextual fields onto the processed payload:
- `targetUnit`: string id of the chosen target (added for target-required action types).
- Movement planning (for `explore` or when stepping toward an out-of-range target):
  - `movedTowardsTarget`: boolean flag indicating a pre-action nudge toward a target.
  - `movedTo`: `{ x: number; y: number }` for the planned tile.
  - `unitId`: acting unit id.
  - `mapId`: map id where the move occurs.
  - `position`: `Position` instance (`@atsu/choukai`) for the planned tile.

## Range handling
- `ActionProcessor.getActionRange` reads `payload.range` when numeric; otherwise defaults to `1`.
- Range is used for distance checks and for deciding whether to plan a step toward the target.
- If a step is planned and the action fails specifically due to range, `StoryTeller` applies the planned move and ends the turn with that movement.

## Example (attack)
```json
{
  "type": "attack",
  "description": "{{unitName}} attacks {{targetUnitName}} aggressively.",
  "payload": {
    "range": 1
  }
}
```
Runtime payload after `StoryTeller` picks a target and plans movement might look like:
```json
{
  "range": 1,
  "targetUnit": "target-id",
  "movedTowardsTarget": true,
  "movedTo": { "x": 4, "y": 2 },
  "unitId": "attacker-id",
  "mapId": "Test Map",
  "position": { "x": 4, "y": 2 }
}
```
