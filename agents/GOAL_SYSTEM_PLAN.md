# Goal System Plan

Lightweight goal-driven action selection for units. Keep the first version simple, deterministic, and testable so we can extend it later.

## Module layout
- `goals.json`: declarative goal definitions (see below) instead of a hardcoded enum; provides ids, labels, completion conditions, and default candidate actions.
- `goal.ts`: goal shape `{ id, priority, data?, status }` where status is `pending|active|done|blocked`.
- `goalEvaluators.ts`: pure functions inspecting unit/world state to propose goals with scores.
- `goalPlanner.ts`: maps a goal id to an ordered list of action types.
- `goalSelector.ts`: picks the best goal per unit (supports stickiness/cooldowns).
- `goalExecutor.ts`: given a goal and action candidates, picks an executable action; falls back safely.
- `goalState.ts`: per-unit store (on the unit object or a side map keyed by unit id).
- Directory: `Takao/unitController/goals/` (or similar) to keep concerns isolated.
- Team/coordination: add a lightweight shared “squad state” (blackboard) to coordinate goals like sticking together.

## Per-turn flow
1) Build context: unit stats, known targets, last action, cooldowns, positional info.
2) Run evaluators → list of candidate goals with scores.
3) Selector picks a goal (optionally keep current unless surpassed by a threshold).
4) Planner maps goal → candidate actions (ordered).
5) Executor filters candidates by requirements (mana, range, target availability) and chooses one (first valid or weighted).
6) If none valid, fallback to a safe default (`rest`/`patrol`/`explore`).

## Goal definitions (JSON, not enum)
- File: `Takao/data/goals.json` (or similar), array of objects:
  ```json
  [
    {
      "id": "RecoverHealth",
      "label": "Recover Health",
      "completion": { "type": "stat_at_least", "stat": "health", "value": 70 }, 
      "candidateActions": ["rest", "retreat", "meditate", "search"]
    },
    {
      "id": "AttackEnemy",
      "label": "Attack Enemy",
      "completion": { "type": "condition_met", "condition": "no_hostile_in_range" },
      "candidateActions": ["attack", "desperate_attack"]
    }
  ]
  ```
- `completion` encodes when the goal is done; the executor/selector marks `done` once the condition is satisfied.
- Evaluators provide the score/priority; JSON provides structure and defaults (so tuning doesn’t require code changes).
- Shared goals (optional): store squad-level entries in `goals.json` with `scope: "squad"` and completion like “all members within N tiles of centroid”; evaluator reads shared state and proposes a `Regroup`/`StayTogether` goal for members that drift.

## Goal vs action (relationship)
- A goal is the “why” (desired state); an action is the “how” (a concrete, executable behavior with requirements and effects).
- Planner/Executor bridges them: goal → ordered candidate actions → first executable action runs.
- Completion is checked against the goal’s condition, not the action. Example: `RecoverHealth` is complete when health% ≥ threshold, regardless of which healing action achieved it.
- Shared goal semantics: a squad-level goal defines desired formation/spacing; each unit derives a local subgoal (e.g., “move toward centroid” or “follow leader”) and marks done when within allowed distance.

## Initial goal rules (simple, tunable constants)
- `RecoverHealth`: if health% < 30 → score 100; < 50 → 70. Actions: `rest`, `retreat`, `meditate`, `search`.
- `RecoverMana`: if mana% < 30 → 80. Actions: `conserve_mana`, `meditate`, `rest`.
- `AttackEnemy`: enemy in range → 80; seen but out of range → 60. Actions: `attack`, `desperate_attack` (only if health% < 30 and mana ≥ 10).
- `SupportAlly`: hurt ally nearby → 70. Actions: `support`, `trade`, `inspire`.
- `Explore/Scout`: default roaming when nothing urgent → 40. Actions: `explore`, `scout`, `patrol`.
- `Train/Grow`: idle and healthy → 30. Actions: `train`, `study`, `craft`.
- `StayTogether` (optional squad goal): if distance to squad centroid or leader > threshold → score high; actions: `move_toward_centroid`, `patrol_near_leader`. Completion: within threshold distance.

## Per-unit state
- `currentGoal`, `lastAction`, optional `goalCooldowns` to prevent thrash.
- Stickiness: keep current goal unless a new one beats it by a margin (e.g., +20 score).

## Integration points
- In the unit controller’s per-turn loop, replace random selection with:
- `GoalSelector.select(unit, context)` → goal
- `GoalExecutor.pickAction(goal, unit, context)` → action type
- Dispatch existing action execution pipeline.
- Action availability check must use current requirements (mana, range, target existence).
- For shared goals: selector can blend squad goal with personal goal using weights or priority tiers (e.g., critical personal goals override, otherwise honor squad cohesion).

## Testing
- Evaluator tests: given health/mana thresholds, assert expected goals/scores.
- Planner/executor tests: low mana removes mana-cost actions; no targets → skips target-dependent actions.
- E2E-ish: a low-health unit chooses `RecoverHealth` and an action in `{rest, retreat, meditate}`.
- Fallback test: when nothing is executable, default to `rest`/`patrol` without throwing.

## Future extensions
- Goal progress tracking (e.g., “heal to >70%” before completion).
- Shared/blackboard goals, personality weights per unit, memory of last failed actions.
- Utility-based scoring (distance, threat) and multi-step plans (move then attack).
