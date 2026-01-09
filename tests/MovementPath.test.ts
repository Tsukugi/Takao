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
});
