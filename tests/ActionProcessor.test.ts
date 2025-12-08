import { describe, it, expect, beforeEach } from 'vitest';
import { BaseUnit } from '@atsu/atago';
import { World, Map as ChoukaiMap, Position } from '@atsu/choukai';
import { ActionProcessor } from '../src/utils/ActionProcessor';

describe('ActionProcessor range validation', () => {
  let world: World;
  let actionProcessor: ActionProcessor;
  let units: BaseUnit[];

  beforeEach(() => {
    world = new World();
    // Create a test map
    const testMap = new ChoukaiMap(10, 10, 'Test Map');
    world.addMap(testMap);

    // Create test units with positions
    const unit1 = new BaseUnit('unit1', 'Player1', 'warrior');
    unit1.setProperty('position', {
      unitId: 'unit1',
      mapId: 'Test Map',
      position: new Position(2, 2),
    });

    const unit2 = new BaseUnit('unit2', 'Player2', 'archer');
    unit2.setProperty('position', {
      unitId: 'unit2',
      mapId: 'Test Map',
      position: new Position(3, 2), // Adjacent to unit1
    });

    const unit3 = new BaseUnit('unit3', 'Player3', 'mage');
    unit3.setProperty('position', {
      unitId: 'unit3',
      mapId: 'Test Map',
      position: new Position(5, 5), // Far from unit1
    });

    const unit4 = new BaseUnit('unit4', 'Player4', 'healer');
    unit4.setProperty('position', {
      unitId: 'unit4',
      mapId: 'Different Map',
      position: new Position(1, 1), // On different map
    });

    units = [unit1, unit2, unit3, unit4];

    actionProcessor = new ActionProcessor(undefined, world);
  });

  it('should allow attack when target is in range', async () => {
    const action = {
      player: 'Player1',
      type: 'attack',
      description: 'Player1 attacks Player2',
      payload: {
        targetUnit: 'unit2',
        range: 1,
      },
    };

    const result = await actionProcessor.executeActionEffect(action, units);
    expect(result.success).toBe(true);
  });

  it('should deny attack when target is out of range', async () => {
    const action = {
      player: 'Player1',
      type: 'attack',
      description: 'Player1 attacks Player3',
      payload: {
        targetUnit: 'unit3',
        range: 1,
      },
    };

    const result = await actionProcessor.executeActionEffect(action, units);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('out of range');
  });

  it('uses player id when validating range', async () => {
    const action = {
      player: 'unit1', // id instead of name
      type: 'attack',
      description: 'Player1 attacks Player3 by id',
      payload: {
        targetUnit: 'unit3',
        range: 1,
      },
    };

    const result = await actionProcessor.executeActionEffect(action, units);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('out of range');
  });

  it('should deny attack when units are on different maps', async () => {
    const action = {
      player: 'Player1',
      type: 'attack',
      description: 'Player1 attacks Player4',
      payload: {
        targetUnit: 'unit4',
        range: 10, // Even with large range, should fail due to different maps
      },
    };

    const result = await actionProcessor.executeActionEffect(action, units);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('different maps');
  });

  it('should allow support when target is in range', async () => {
    const action = {
      player: 'Player1',
      type: 'support',
      description: 'Player1 supports Player2',
      payload: {
        targetUnit: 'unit2',
        range: 2,
      },
    };

    const result = await actionProcessor.executeActionEffect(action, units);
    expect(result.success).toBe(true);
  });

  it('should deny support when target is out of range', async () => {
    const action = {
      player: 'Player1',
      type: 'support',
      description: 'Player1 supports Player3',
      payload: {
        targetUnit: 'unit3',
        range: 2,
      },
    };

    const result = await actionProcessor.executeActionEffect(action, units);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('out of range');
  });

  it('defaults to range 1 without payload range and respects payload range when present', async () => {
    const action = {
      player: 'Player1',
      type: 'attack',
      description: 'Player1 attacks Player3',
      payload: {
        targetUnit: 'unit3',
      },
    };

    const tooFar = await actionProcessor.executeActionEffect(action, units);
    expect(tooFar.success).toBe(false); // default range 1

    action.payload.range = 6;
    const withinRange = await actionProcessor.executeActionEffect(action, units);
    expect(withinRange.success).toBe(true);
  });

  it('should allow action when no target unit specified', async () => {
   const action = {
     player: 'Player1',
     type: 'rest',
     description: 'Player1 rests',
   };

   const result = await actionProcessor.executeActionEffect(action, units);
   expect(result.success).toBe(true);
  });

  it('adds missing properties with baseline value before applying effects', async () => {
    const action = {
      player: 'Player1',
      type: 'custom_missing_prop',
      description: 'Player1 gains courage',
      effects: [
        {
          target: 'self',
          property: 'courage',
          operation: 'add',
          value: { type: 'static', value: 2 },
          permanent: false,
        },
      ],
    };

    const result = await actionProcessor.executeActionEffect(action, units);

    expect(result.success).toBe(true);
    expect(units[0].getPropertyValue('courage')).toBe(3); // initialized to 1 then +2
  });
});
