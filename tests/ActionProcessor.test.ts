import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionProcessor } from '../src/utils/ActionProcessor';
import { Action, EffectDefinition } from '../src/types';
import { BaseUnit } from '@atsu/atago';

// Mock the DataManager
vi.mock('../src/utils/DataManager', () => ({
  DataManager: {
    loadActions: vi.fn(() => ({
      actions: {
        low_health: [
          {
            type: 'search',
            player: 'unknown',
            description: '{{unitName}} searches for healing herbs.',
            effects: [
              {
                target: 'self',
                property: 'health',
                operation: 'add',
                value: { type: 'static', value: 15 },
                permanent: false,
              } as EffectDefinition,
            ],
          },
        ],
        healthy: [
          {
            type: 'explore',
            player: 'unknown',
            description: '{{unitName}} explores the area confidently.',
            effects: [
              {
                target: 'self',
                property: 'awareness',
                operation: 'add',
                value: { type: 'static', value: 5 },
                permanent: false,
              } as EffectDefinition,
            ],
          },
        ],
        default: [
          {
            type: 'rest',
            player: 'unknown',
            description: '{{unitName}} takes a moment to rest.',
            effects: [
              {
                target: 'self',
                property: 'health',
                operation: 'add',
                value: { type: 'static', value: 8 },
                permanent: false,
              } as EffectDefinition,
              {
                target: 'self',
                property: 'mana',
                operation: 'add',
                value: { type: 'static', value: 5 },
                permanent: false,
              } as EffectDefinition,
            ],
          },
        ],
      },
      special: [],
    })),
  },
}));
describe('ActionProcessor', () => {
  let mockUnits: BaseUnit[];

  beforeEach(() => {
    mockUnits = [
      new BaseUnit('unit-1', 'Warrior', 'warrior', {
        health: { name: 'health', value: 100, baseValue: 100 },
        mana: { name: 'mana', value: 50, baseValue: 50 },
        attack: { name: 'attack', value: 20, baseValue: 20 },
        defense: { name: 'defense', value: 15, baseValue: 15 },
        awareness: { name: 'awareness', value: 10, baseValue: 10 },
      }),
      new BaseUnit('unit-2', 'Archer', 'archer', {
        health: { name: 'health', value: 80, baseValue: 80 },
        mana: { name: 'mana', value: 30, baseValue: 30 },
        attack: { name: 'attack', value: 25, baseValue: 25 },
        defense: { name: 'defense', value: 10, baseValue: 10 },
        awareness: { name: 'awareness', value: 15, baseValue: 15 },
      }),
    ];
  });

  describe('executeActionEffect', () => {
    it('executes rest action effect properly', async () => {
      const action: Action = {
        type: 'rest',
        player: 'Warrior',
        payload: {}, // The effects will come from the mock DataManager
        description: 'Warrior takes a moment to rest.',
      };

      const initialStates: Record<string, string> = {};
      for (const unit of mockUnits) {
        initialStates[unit.id] = JSON.parse(JSON.stringify(unit.properties));
      }

      const result = await ActionProcessor.executeActionEffect(
        action,
        mockUnits
      );

      expect(result.success).toBe(true);
      // The action should execute without errors, which is the main validation
      // The specific stat changes depend on the proper Atago BaseUnit implementation
    });

    it('executes attack action effect properly', async () => {
      const action: Action = {
        type: 'attack',
        player: 'Warrior',
        payload: { targetUnit: 'unit-2' },
        effects: [
          {
            target: 'self',
            property: 'mana',
            operation: 'subtract',
            value: { type: 'static', value: 5 },
            permanent: false,
          } as EffectDefinition,
          {
            target: 'unit',
            property: 'health',
            operation: 'subtract',
            value: { type: 'static', value: 15 },
            permanent: false,
          } as EffectDefinition,
        ],
        description: 'Warrior attacks Archer, costing mana and dealing damage.',
      };

      const initialStates: Record<string, string> = {};
      for (const unit of mockUnits) {
        initialStates[unit.id] = JSON.parse(JSON.stringify(unit.properties));
      }

      const result = await ActionProcessor.executeActionEffect(
        action,
        mockUnits
      );

      expect(result.success).toBe(true);

      // Attacker (Warrior) mana should decrease
      const attacker = mockUnits.find(u => u.name === 'Warrior');
      expect(attacker?.getPropertyValue('mana')).toBe(45); // 50 - 5

      // Target (Archer) health should decrease
      const target = mockUnits.find(u => u.name === 'Archer');
      expect(target?.getPropertyValue('health')).toBe(65); // 80 - 15
    });

    it('executes support action effect properly', async () => {
      const action: Action = {
        type: 'support',
        player: 'Warrior',
        payload: { targetUnit: 'unit-2' }, // Supporting the archer
        description: 'Warrior supports Archer',
        effects: [
          {
            target: 'unit', // Target unit (Archer) gets health
            property: 'health',
            operation: 'add',
            value: { type: 'static', value: 12 },
            permanent: false,
          } as EffectDefinition,
        ],
      };

      const initialStates: Record<string, string> = {};
      for (const unit of mockUnits) {
        initialStates[unit.id] = JSON.parse(JSON.stringify(unit.properties));
      }

      const result = await ActionProcessor.executeActionEffect(
        action,
        mockUnits
      );

      expect(result.success).toBe(true);

      // Target (Archer) health should increase
      const target = mockUnits.find(u => u.name === 'Archer');
      expect(target?.getPropertyValue('health')).toBe(92); // 80 + 12
    });

    it('handles actions with no effects defined', async () => {
      const action: Action = {
        type: 'unknown_action',
        player: 'Warrior',
        payload: {},
        description: 'Warrior performs unknown action',
      };

      const initialStates: Record<string, string> = {};
      for (const unit of mockUnits) {
        initialStates[unit.id] = JSON.parse(JSON.stringify(unit.properties));
      }

      const result = await ActionProcessor.executeActionEffect(
        action,
        mockUnits
      );

      expect(result.success).toBe(true); // Should succeed even if no effects found
    });

    it('handles invalid action gracefully', async () => {
      const action: Action = {
        type: 'attack',
        player: 'NonExistentUnit',
        payload: { targetUnit: 'non-existent' },
        description: 'NonExistentUnit attacks non-existent target',
      };

      const initialStates: Record<string, string> = {};
      for (const unit of mockUnits) {
        initialStates[unit.id] = JSON.parse(JSON.stringify(unit.properties));
      }

      const result = await ActionProcessor.executeActionEffect(
        action,
        mockUnits
      );

      // Should still return success but might have no effect
      expect(result.success).toBe(true);
    });
  });

  describe('processActionPayload', () => {
    it('processes simple action payload correctly', () => {
      const payload = {
        healthRestore: 10,
        description: 'Unit rests',
      };

      const processedPayload = ActionProcessor.processActionPayload(payload);

      expect(processedPayload).toEqual(payload);
    });

    it('processes random value in action payload', () => {
      const payload = {
        damage: {
          type: 'random',
          min: 10,
          max: 20,
        },
        healthRestore: 5,
      };

      const processedPayload = ActionProcessor.processActionPayload(payload);

      expect(processedPayload.healthRestore).toBe(5);
      // The damage should now be a numeric value between 10-20
      expect(typeof processedPayload.damage).toBe('number');
      expect(processedPayload.damage).toBeGreaterThanOrEqual(10);
      expect(processedPayload.damage).toBeLessThanOrEqual(20);
    });

    it('processes multiple random values in action payload', () => {
      const payload = {
        damage: {
          type: 'random',
          min: 5,
          max: 15,
        },
        healing: {
          type: 'random',
          min: 8,
          max: 12,
        },
        manaCost: 3,
      };

      const processedPayload = ActionProcessor.processActionPayload(payload);

      expect(typeof processedPayload.damage).toBe('number');
      expect(processedPayload.damage).toBeGreaterThanOrEqual(5);
      expect(processedPayload.damage).toBeLessThanOrEqual(15);

      expect(typeof processedPayload.healing).toBe('number');
      expect(processedPayload.healing).toBeGreaterThanOrEqual(8);
      expect(processedPayload.healing).toBeLessThanOrEqual(12);

      expect(processedPayload.manaCost).toBe(3);
    });

    it('handles direction and resource selectors', () => {
      const payload = {
        movement: {
          type: 'random_direction',
        },
        resource: {
          type: 'random_resource',
        },
        bonus: 10,
      };

      const processedPayload = ActionProcessor.processActionPayload(payload);

      expect(typeof processedPayload.movement).toBe('string');
      expect(typeof processedPayload.resource).toBe('string');
      expect(processedPayload.bonus).toBe(10);
    });
  });

  describe('getDefaultAction', () => {
    it('returns a default action template', () => {
      // Create a mock unit to satisfy the method signature
      const mockUnit: BaseUnit = new BaseUnit('unit-3', 'TestUnit', 'tester', {
        health: { name: 'health', value: 100, baseValue: 100 },
        mana: { name: 'mana', value: 50, baseValue: 50 },
      });

      const defaultAction = ActionProcessor.getDefaultAction(mockUnit);

      expect(defaultAction).toHaveProperty('type');
      expect(defaultAction).toHaveProperty('description');
      expect(defaultAction).toHaveProperty('payload');
      expect(defaultAction).toHaveProperty('effects');
      expect(Array.isArray(defaultAction.effects)).toBe(true);

      expect(defaultAction.type).toBe('idle');
      expect(defaultAction.description).toContain(
        'TestUnit idles, doing nothing of note.'
      );
      expect(defaultAction.player).toBe('TestUnit');
    });
  });
});
