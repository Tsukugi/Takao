/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryTeller } from '../src/core/StoryTeller';
import { UnitController } from '../src/ai/UnitController';
import { World, Map as ChoukaiMap, Position } from '@atsu/choukai';
import { BaseUnit, IUnitPosition } from '@atsu/atago';
import { MathUtils } from '../src/utils/Math';

describe('StoryTeller range-aware movement logging', () => {
  let unitController: UnitController;
  let world: World;
  let getRandomSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(async () => {
    unitController = new UnitController();
    await unitController.initialize({ turn: 0 });

    world = new World();
    const map = new ChoukaiMap(10, 10, 'Test Map');
    world.addMap(map);
  });

  beforeEach(() => {
    getRandomSpy = vi
      .spyOn(MathUtils, 'getRandomFromArray')
      .mockImplementation(arr => arr[0]) as any;
  });

  afterEach(() => {
    getRandomSpy?.mockRestore();
    getRandomSpy = null;
  });

  it('annotates diary description when moving closer to a target', async () => {
    // Two units far apart on the same map
    const attacker = new BaseUnit('attacker', 'Attacker', 'warrior');
    attacker.setProperty('faction', 'Adventurers');
    attacker.setProperty('health', 10);
    attacker.setProperty('position', {
      unitId: 'attacker',
      mapId: 'Test Map',
      position: new Position(0, 0),
    });

    const target = new BaseUnit('target', 'Target', 'archer');
    target.setProperty('faction', 'Wild Animals');
    target.setProperty('health', 10);
    target.setProperty('position', {
      unitId: 'target',
      mapId: 'Test Map',
      position: new Position(5, 5),
    });

    (unitController as any).gameUnits = [attacker, target];

    const storyTeller = new StoryTeller(unitController, world);

    // Force a single attack action with range 1
    const customAction = {
      type: 'attack',
      description: '{{unitName}} attacks {{targetUnitName}} aggressively.',
      payload: {
        range: 1,
      },
    };

    (storyTeller as any).actionsData = [customAction];
    (storyTeller as any).goalSystem.chooseAction = () => ({
      action: customAction,
      candidateActions: [customAction],
    });

    const result = await (storyTeller as any).createStoryBasedOnUnits(
      [attacker, target],
      1,
      { round: 1, turnInRound: 1, turnOrder: ['attacker', 'target'] }
    );

    const primary = result.executions[0];
    const plannedPosition = primary.action.payload as
      | { position: { x: number; y: number }; mapId?: string }
      | undefined;
    expect(primary.action.description).toBe(
      'Attacker is moving closer to Target'
    );
    expect(plannedPosition).toBeTruthy();
    await (storyTeller as any).applyPlannedMove(primary);
    const movedPos =
      attacker.getPropertyValue<IUnitPosition>('position')?.position;
    expect(movedPos).toBeTruthy();
    expect(movedPos?.x).toBe(plannedPosition?.position.x);
    expect(movedPos?.y).toBe(plannedPosition?.position.y);
  });

  it('does not move when already in range', async () => {
    const attacker = new BaseUnit('attacker', 'Attacker', 'warrior');
    attacker.setProperty('faction', 'Adventurers');
    attacker.setProperty('health', 10);
    attacker.setProperty('position', {
      unitId: 'attacker',
      mapId: 'Test Map',
      position: new Position(1, 1),
    });

    const target = new BaseUnit('target', 'Target', 'archer');
    target.setProperty('faction', 'Wild Animals');
    target.setProperty('health', 10);
    target.setProperty('position', {
      unitId: 'target',
      mapId: 'Test Map',
      position: new Position(2, 1),
    });

    (unitController as any).gameUnits = [attacker, target];

    const storyTeller = new StoryTeller(unitController, world);
    const moveSpy = vi.spyOn(storyTeller, 'moveUnitToPosition');

    const customAction = {
      type: 'attack',
      description: '{{unitName}} attacks {{targetUnitName}} aggressively.',
      payload: {
        range: 1,
      },
    };

    (storyTeller as any).actionsData = [customAction];
    (storyTeller as any).goalSystem.chooseAction = () => ({
      action: customAction,
      candidateActions: [customAction],
    });

    await (storyTeller as any).createStoryBasedOnUnits([attacker, target], 1, {
      round: 1,
      turnInRound: 1,
      turnOrder: ['attacker', 'target'],
    });
    expect(moveSpy).not.toHaveBeenCalled();
    const pos = attacker.getPropertyValue<IUnitPosition>('position')?.position;
    expect(pos?.x).toBe(1);
    expect(pos?.y).toBe(1);
  });

  it('prefers the closest hostile target when multiple are available', async () => {
    const attacker = new BaseUnit('attacker', 'Attacker', 'warrior');
    attacker.setProperty('faction', 'Adventurers');
    attacker.setProperty('health', 10);
    attacker.setProperty('position', {
      unitId: 'attacker',
      mapId: 'Test Map',
      position: new Position(0, 0),
    });

    const nearTarget = new BaseUnit('near', 'Near', 'archer');
    nearTarget.setProperty('faction', 'Wild Animals');
    nearTarget.setProperty('health', 10);
    nearTarget.setProperty('position', {
      unitId: 'near',
      mapId: 'Test Map',
      position: new Position(1, 0),
    });

    const farTarget = new BaseUnit('far', 'Far', 'archer');
    farTarget.setProperty('faction', 'Wild Animals');
    farTarget.setProperty('health', 10);
    farTarget.setProperty('position', {
      unitId: 'far',
      mapId: 'Test Map',
      position: new Position(5, 5),
    });

    (unitController as any).gameUnits = [attacker, nearTarget, farTarget];

    const storyTeller = new StoryTeller(unitController, world);

    const customAction = {
      type: 'attack',
      description: '{{unitName}} attacks {{targetUnitName}} aggressively.',
      payload: {
        range: 1,
      },
    };

    (storyTeller as any).actionsData = [customAction];
    (storyTeller as any).goalSystem.chooseAction = () => ({
      action: customAction,
      candidateActions: [customAction],
    });

    const result = await (storyTeller as any).createStoryBasedOnUnits(
      [attacker, nearTarget, farTarget],
      1,
      { round: 1, turnInRound: 1, turnOrder: ['attacker', 'near', 'far'] }
    );

    expect(result.executions[0].action.payload?.targetUnit).toBe('near');
  });

  it('skips dead targets when selecting an enemy', async () => {
    const attacker = new BaseUnit('attacker', 'Attacker', 'warrior');
    attacker.setProperty('faction', 'Adventurers');
    attacker.setProperty('health', 10);
    attacker.setProperty('position', {
      unitId: 'attacker',
      mapId: 'Test Map',
      position: new Position(0, 0),
    });

    const deadTarget = new BaseUnit('dead', 'Dead', 'archer');
    deadTarget.setProperty('faction', 'Wild Animals');
    deadTarget.setProperty('status', 'dead');
    deadTarget.setProperty('health', 0);
    deadTarget.setProperty('position', {
      unitId: 'dead',
      mapId: 'Test Map',
      position: new Position(1, 0),
    });

    const liveTarget = new BaseUnit('alive', 'Alive', 'archer');
    liveTarget.setProperty('faction', 'Wild Animals');
    liveTarget.setProperty('health', 10);
    liveTarget.setProperty('position', {
      unitId: 'alive',
      mapId: 'Test Map',
      position: new Position(2, 0),
    });

    (unitController as any).gameUnits = [attacker, deadTarget, liveTarget];

    const storyTeller = new StoryTeller(unitController, world);

    const customAction = {
      type: 'attack',
      description: '{{unitName}} attacks {{targetUnitName}} aggressively.',
      payload: {
        range: 1,
      },
    };

    (storyTeller as any).actionsData = [customAction];
    (storyTeller as any).goalSystem.chooseAction = () => ({
      action: customAction,
      candidateActions: [customAction],
    });

    const result = await (storyTeller as any).createStoryBasedOnUnits(
      [attacker, deadTarget, liveTarget],
      1,
      { round: 1, turnInRound: 1, turnOrder: ['attacker', 'alive', 'dead'] }
    );

    expect(result.executions[0].action.payload?.targetUnit).toBe('alive');
  });

  it('nudges to nearest free tile to avoid overlap when moving', async () => {
    const attacker = new BaseUnit('attacker', 'Attacker', 'warrior');
    attacker.setProperty('faction', 'Adventurers');
    attacker.setProperty('health', 10);
    attacker.setProperty('position', {
      unitId: 'attacker',
      mapId: 'Test Map',
      position: new Position(0, 0),
    });

    const blocker = new BaseUnit('blocker', 'Blocker', 'archer');
    blocker.setProperty('faction', 'Wild Animals');
    blocker.setProperty('health', 10);
    blocker.setProperty('position', {
      unitId: 'blocker',
      mapId: 'Test Map',
      position: new Position(1, 0),
    });

    const target = new BaseUnit('target', 'Target', 'archer');
    target.setProperty('faction', 'Wild Animals');
    target.setProperty('health', 10);
    target.setProperty('position', {
      unitId: 'target',
      mapId: 'Test Map',
      position: new Position(2, 0),
    });

    (unitController as any).gameUnits = [attacker, blocker, target];

    const storyTeller = new StoryTeller(unitController, world);

    const customAction = {
      type: 'attack',
      description: '{{unitName}} attacks {{targetUnitName}} aggressively.',
      payload: {
        range: 1,
      },
    };

    (storyTeller as any).actionsData = [customAction];
    (storyTeller as any).goalSystem.chooseAction = () => ({
      action: customAction,
      candidateActions: [customAction],
    });

    await (storyTeller as any).createStoryBasedOnUnits(
      [attacker, blocker, target],
      1,
      { round: 1, turnInRound: 1, turnOrder: ['attacker', 'blocker', 'target'] }
    );

    const pos = attacker.getPropertyValue<IUnitPosition>('position')?.position;
    // Either stays or moves to a free adjacent tile; must not overlap blocker at (1,0)
    expect(pos?.x === 1 && pos?.y === 0).toBe(false);
  });
});
