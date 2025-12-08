# Enemy Spawn Plan

Simple Enemies plan to spawn enemies randomly. 
Until we have a better and more sophisticated impl.


Goal: Every 10 turns, if there are fewer than 3 units with faction `Wild Animals`, spawn a wolf that is hostile to player units.

## Detection
- Hook into turn progression (e.g., `TakaoImpl.runTurn`) to access current turn and unit list.
- Count units whose `faction` property is `Wild Animals`.

## Conditions
- Trigger check on turns divisible by 10.
- If count < 3, spawn a new wolf unit.

## Spawn behavior
- Use `UnitController.addNewUnit`-like flow or a dedicated spawn helper to create a wolf with faction `Wild Animals` and relationships set to hostile toward player factions.
- Position: place on the main map at a valid random or edge location (reuse `WorldManager`/`WorldController` or `World` directly).

## Integration
- After spawning, ensure the new unit is registered in the controller and added to the world with a position.
- Log the spawn for visibility.

## Safety
- Avoid spawning when no maps exist.
- Ensure relationship/faction data is set so wolves are treated as hostiles by the relationship helper.
