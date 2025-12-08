import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryTeller } from '../src/core/StoryTeller';
import { UnitController } from '../src/ai/UnitController';
import { World, Map as ChoukaiMap, Position } from '@atsu/choukai';
import { BaseUnit } from '@atsu/atago';
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
      .mockImplementation(arr => arr[0]);
  });

  afterEach(() => {
    getRandomSpy?.mockRestore();
    getRandomSpy = null;
  });

  it('annotates diary description when moving closer to a target', async () => {
    // Two units far apart on the same map
    const attacker = new BaseUnit('attacker', 'Attacker', 'warrior');
    attacker.setProperty('position', {
      unitId: 'attacker',
      mapId: 'Test Map',
      position: new Position(0, 0),
    });

    const target = new BaseUnit('target', 'Target', 'archer');
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
    });

    const executed = await (storyTeller as any).createStoryBasedOnUnits(
      [attacker, target],
      1
    );

    expect(executed.action.description).toContain('Moves closer to Target');
  });
});
