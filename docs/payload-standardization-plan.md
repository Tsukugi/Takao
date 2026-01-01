# Payload Standardization Plan

Goal: replace ambiguous `value.type === "variable"` effect handling with explicit `modifyProperty` payload/value shapes, and document all payload behaviors.

## Targets
- Add first-class `modifyProperty` effect value support in code and typings.
- Migrate `data/actions.json` effects that use `type: "variable"` to the new shape.
- Keep backward compatibility temporarily (variable still works) to avoid breaking downstream code.
- Update documentation to reflect the new shape and migration guidance.

## Steps
1) **Types**: extend `EffectValue` to include a `modifyProperty` variant with `key` (property name) and nested `value` (number or existing value specs like random/calculated).
2) **Runtime logic**: update `ActionProcessor` effect calculation to:
   - Detect `modifyProperty`, compute the numeric delta from its nested value, and apply it to `key` (overriding `effect.property`).
   - Support numbers directly as value specs for convenience.
   - Drop `variable` handling once migrations are complete. ✅ done
3) **Data migration**: rewrite `data/actions.json` effects with `value.type === "variable"` to use `modifyProperty` with concrete nested specs. ✅ done
4) **Docs**: update `docs/action-payloads.md` to describe `modifyProperty` as the only dynamic value wrapper. ✅ done
5) **Tests**: run Takao test suite to ensure behavior stays consistent. ✅ done
6) **Cleanup**: remove leftover `variable` support from types and runtime. ✅ done
