import { describe, it, expect, beforeEach } from 'vitest';
import { World, Map as ChoukaiMap, Position } from '@atsu/choukai';
import { BaseUnit, type IUnitPosition } from '@atsu/atago';
import { UnitController } from '../src/ai/UnitController';
import { WorldManager } from '../src/core/WorldManager';
import { GateSystem } from '../src/utils/GateSystem';
import { Logger } from '../src/utils/Logger';

const setUnitPosition = (
  unit: BaseUnit,
  mapId: string,
  x: number,
  y: number
) => {
  unit.setProperty('position', {
    unitId: unit.id,
    mapId,
    position: new Position(x, y),
  });
};

const assignSafePositions = (
  units: BaseUnit[],
  mapId: string,
  mapWidth: number,
  startY: number
) => {
  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i];
    if (!unit) {
      continue;
    }

    const x = i % mapWidth;
    const y = startY + Math.floor(i / mapWidth);
    setUnitPosition(unit, mapId, x, y);
  }
};

describe('WorldManager movement paths', () => {
  let unitController: UnitController;
  let world: World;
  let map: ChoukaiMap;
  let worldManager: WorldManager;

  beforeEach(async () => {
    unitController = new UnitController();
    await unitController.initialize({ turn: 0 });

    world = new World();
    map = new ChoukaiMap(20, 20, 'Test Map');
    world.addMap(map);

    worldManager = new WorldManager(
      world,
      unitController,
      new GateSystem(),
      new Logger({ prefix: 'WorldManager', disable: true })
    );
  });

  it('applies a multi-step movement path', async () => {
    const units = unitController.getUnits();
    const mover = units[0];
    if (!mover) {
      throw new Error('UnitController did not initialize with any units.');
    }

    assignSafePositions(units, map.name, map.width, 10);
    mover.setProperty('movementRange', 3);
    setUnitPosition(mover, map.name, 0, 0);

    const target = new BaseUnit('target', 'Target', 'archer');
    setUnitPosition(target, map.name, 4, 0);

    const plan = worldManager.planMovementTowardTarget(
      mover,
      target,
      [...units, target],
      1
    );
    expect(plan.steps).toHaveLength(3);

    const stepsApplied = await worldManager.applyMovementPath(
      mover.id,
      plan.steps
    );
    expect(stepsApplied).toBe(3);

    const movedPos = mover.getPropertyValue<IUnitPosition>('position');
    expect(movedPos?.position.x).toBe(3);
    expect(movedPos?.position.y).toBe(0);
  });

  it('avoids occupied tiles when planning movement', () => {
    const mover = new BaseUnit('mover', 'Mover', 'warrior');
    mover.setProperty('movementRange', 5);
    setUnitPosition(mover, map.name, 0, 2);

    const target = new BaseUnit('target', 'Target', 'archer');
    setUnitPosition(target, map.name, 4, 2);

    const blocker = new BaseUnit('blocker', 'Blocker', 'guardian');
    setUnitPosition(blocker, map.name, 1, 2);

    const plan = worldManager.planMovementTowardTarget(
      mover,
      target,
      [mover, target, blocker],
      1
    );

    const hitsBlockedTile = plan.steps.some(
      step =>
        step.mapId === map.name &&
        step.position.x === 1 &&
        step.position.y === 2
    );

    expect(hitsBlockedTile).toBe(false);
  });

  it('limits planned steps to movementRange when target is farther than range', () => {
    const mover = new BaseUnit('mover', 'Mover', 'warrior');
    mover.setProperty('movementRange', 2);
    setUnitPosition(mover, map.name, 0, 0);

    const target = new BaseUnit('target', 'Target', 'archer');
    setUnitPosition(target, map.name, 4, 0);

    const plan = worldManager.planMovementTowardTarget(
      mover,
      target,
      [mover, target],
      1
    );

    expect(plan.steps).toHaveLength(2);
    const lastStep = plan.steps[plan.steps.length - 1];
    expect(lastStep?.position.x).toBe(2);
    expect(lastStep?.position.y).toBe(0);
  });

  it('throws when a wall blocks all routes to the target', () => {
    // Build a 3x3 corridor blocked in the middle row
    const blockedMap = new ChoukaiMap(3, 3, 'Blocked');
    blockedMap.setTerrain(0, 1, 'wall');
    blockedMap.setTerrain(1, 1, 'wall');
    blockedMap.setTerrain(2, 1, 'wall');
    world = new World();
    world.addMap(blockedMap);

    worldManager = new WorldManager(
      world,
      unitController,
      new GateSystem(),
      new Logger({ prefix: 'WorldManager', disable: true })
    );

    const mover = new BaseUnit('mover', 'Mover', 'warrior');
    mover.setProperty('movementRange', 3);
    setUnitPosition(mover, blockedMap.name, 0, 0);

    const target = new BaseUnit('target', 'Target', 'archer');
    setUnitPosition(target, blockedMap.name, 2, 2);

    expect(() =>
      worldManager.planMovementTowardTarget(mover, target, [mover, target], 1)
    ).toThrow(/No path found/i);
  });

  it('throws when no reachable tile exists within action range of the target', () => {
    const tightMap = new ChoukaiMap(3, 3, 'Tight');
    tightMap.setTerrain(1, 0, 'wall');
    tightMap.setTerrain(1, 1, 'wall');
    tightMap.setTerrain(0, 1, 'wall');
    tightMap.setTerrain(2, 1, 'wall');
    const isolatedWorld = new World();
    isolatedWorld.addMap(tightMap);

    const isolatedManager = new WorldManager(
      isolatedWorld,
      unitController,
      new GateSystem(),
      new Logger({ prefix: 'WorldManager', disable: true })
    );

    const mover = new BaseUnit('mover', 'Mover', 'warrior');
    mover.setProperty('movementRange', 3);
    setUnitPosition(mover, tightMap.name, 0, 0);

    const target = new BaseUnit('target', 'Target', 'archer');
    setUnitPosition(target, tightMap.name, 2, 0);

    expect(() =>
      isolatedManager.planMovementTowardTarget(
        mover,
        target,
        [mover, target],
        1
      )
    ).toThrow(/No available goal positions/i);
  });

  it('nudges onto a nearby free tile when a collision occurs', async () => {
    const units = unitController.getUnits();
    const mover = units[0];
    const blocker = units[1];
    if (!mover || !blocker) {
      throw new Error('UnitController did not initialize with two units.');
    }

    mover.setProperty('movementRange', 2);
    blocker.setProperty('movementRange', 2);

    setUnitPosition(mover, map.name, 0, 0);
    setUnitPosition(blocker, map.name, 0, 0);

    const moved = await worldManager.moveUnitToPosition(mover.id, 0, 0);
    expect(moved).toBe(true);

    const moverPos = mover.getPropertyValue<IUnitPosition>('position');
    const blockerPos = blocker.getPropertyValue<IUnitPosition>('position');
    expect(moverPos).toBeTruthy();
    expect(blockerPos).toBeTruthy();
    expect(
      moverPos &&
        blockerPos &&
        (moverPos.position.x !== blockerPos.position.x ||
          moverPos.position.y !== blockerPos.position.y)
    ).toBe(true);
  });
});
