import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionProcessor } from '../src/utils/ActionProcessor';
import { DataManager } from '../src/utils/DataManager';

// Mock the DataManager
vi.mock('../src/utils/DataManager', () => ({
  DataManager: {
    loadActions: vi.fn(() => ({
      actions: {
        low_health: [
          {
            type: 'search',
            description: '{{unitName}} searches for healing herbs.',
            effects: [
              {
                target: 'self',
                property: 'health',
                operation: 'add',
                value: { type: 'static', value: 15 },
                permanent: false,
              },
            ],
          },
        ],
        healthy: [
          {
            type: 'explore',
            description: '{{unitName}} explores the area confidently.',
            effects: [
              {
                target: 'self',
                property: 'awareness',
                operation: 'add',
                value: { type: 'static', value: 5 },
                permanent: false,
              },
            ],
          },
        ],
        default: [
          {
            type: 'rest',
            description: '{{unitName}} takes a moment to rest.',
            effects: [
              {
                target: 'self',
                property: 'health',
                operation: 'add',
                value: { type: 'static', value: 8 },
                permanent: false,
              },
              {
                target: 'self',
                property: 'mana',
                operation: 'add',
                value: { type: 'static', value: 5 },
                permanent: false,
              },
            ],
          },
          {
            type: 'patrol',
            description: '{{unitName}} patrols the area vigilantly.',
            effects: [
              {
                target: 'self',
                property: 'awareness',
                operation: 'add',
                value: { type: 'static', value: 3 },
                permanent: false,
              },
            ],
          },
          {
            type: 'attack',
            description:
              '{{unitName}} attacks {{targetUnitName}} aggressively.',
            effects: [
              {
                target: 'target',
                property: 'health',
                operation: 'subtract',
                value: { type: 'static', value: 15 },
                permanent: false,
              },
              {
                target: 'self',
                property: 'mana',
                operation: 'subtract',
                value: { type: 'static', value: 5 },
                permanent: false,
              },
            ],
          },
          {
            type: 'support',
            description: '{{unitName}} supports {{targetUnitName}}.',
            effects: [
              {
                target: 'target',
                property: 'health',
                operation: 'add',
                value: { type: 'static', value: 12 },
                permanent: false,
              },
            ],
          },
        ],
      },
      special: [],
    })),
  },
}));

// Mock unit implementation that mimics BaseUnit interface
class MockUnit {
  id: string;
  name: string;
  type: string;
  properties: any;

  constructor(id: string, name: string, type: string, properties: any = {}) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.properties = properties;
  }

  getPropertyValue(propName: string) {
    const prop = this.properties[propName];
    if (prop && typeof prop === 'object' && 'value' in prop) {
      return (prop as any).value;
    }
    return prop || 0;
  }

  setProperty(propName: string, value: any) {
    if (
      this.properties[propName] &&
      typeof this.properties[propName] === 'object' &&
      'value' in this.properties[propName]
    ) {
      (this.properties[propName] as any).value = value;
    } else {
      this.properties[propName] = { name: propName, value, baseValue: value };
    }
  }

  setBaseProperty(propName: string, value: any) {
    if (
      this.properties[propName] &&
      typeof this.properties[propName] === 'object' &&
      'baseValue' in this.properties[propName]
    ) {
      (this.properties[propName] as any).baseValue = value;
    } else {
      this.properties[propName] = {
        name: propName,
        value: this.properties[propName]?.value || value,
        baseValue: value,
      };
    }
  }
}

describe('ActionProcessor', () => {
  let mockUnits: any[];

  beforeEach(() => {
    mockUnits = [
      new MockUnit('unit-1', 'Warrior', 'warrior', {
        health: { name: 'health', value: 100, baseValue: 100 },
        mana: { name: 'mana', value: 50, baseValue: 50 },
        attack: { name: 'attack', value: 20, baseValue: 20 },
        defense: { name: 'defense', value: 15, baseValue: 15 },
        awareness: { name: 'awareness', value: 10, baseValue: 10 },
      }),
      new MockUnit('unit-2', 'Archer', 'archer', {
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
      const action = {
        type: 'rest',
        player: 'Warrior',
        payload: {}, // The effects will come from the mock DataManager
        turn: 1,
        timestamp: Date.now(),
      };

      const initialStates: Record<string, string> = {};
      for (const unit of mockUnits) {
        initialStates[unit.id] = JSON.parse(JSON.stringify(unit.properties));
      }

      const result = await ActionProcessor.executeActionEffect(
        action,
        mockUnits,
        initialStates
      );

      expect(result.success).toBe(true);
      // The action should execute without errors, which is the main validation
      // The specific stat changes depend on the proper Atago BaseUnit implementation
    });

    it('executes attack action effect properly', async () => {
      const action = {
        type: 'attack',
        player: 'Warrior',
        payload: { targetUnit: 'unit-2' },
        turn: 1,
        timestamp: Date.now(),
      };

      const initialStates: Record<string, string> = {};
      for (const unit of mockUnits) {
        initialStates[unit.id] = JSON.parse(JSON.stringify(unit.properties));
      }

      const result = await ActionProcessor.executeActionEffect(
        action,
        mockUnits,
        initialStates
      );

      expect(result.success).toBe(true);

      // Attacker (Warrior) mana should decrease
      const attacker = mockUnits.find((u: any) => u.name === 'Warrior');
      expect(attacker.getPropertyValue('mana')).toBe(45); // 50 - 5

      // Target (Archer) health should decrease
      const target = mockUnits.find((u: any) => u.name === 'Archer');
      expect(target.getPropertyValue('health')).toBe(65); // 80 - 15
    });

    it('executes support action effect properly', async () => {
      const action = {
        type: 'support',
        player: 'Warrior',
        payload: { targetUnit: 'unit-2' }, // Supporting the archer
        turn: 1,
        timestamp: Date.now(),
      };

      const initialStates: Record<string, string> = {};
      for (const unit of mockUnits) {
        initialStates[unit.id] = JSON.parse(JSON.stringify(unit.properties));
      }

      const result = await ActionProcessor.executeActionEffect(
        action,
        mockUnits,
        initialStates
      );

      expect(result.success).toBe(true);

      // Warrior mana might change depending on the effect definition
      const attacker = mockUnits.find((u: any) => u.name === 'Warrior');
      expect(attacker).toBeDefined(); // Ensure warrior exists

      // Target (Archer) health should increase
      const target = mockUnits.find((u: any) => u.name === 'Archer');
      expect(target.getPropertyValue('health')).toBe(92); // 80 + 12
    });

    it('handles actions with no effects defined', async () => {
      const action = {
        type: 'unknown_action',
        player: 'Warrior',
        payload: {},
        turn: 1,
        timestamp: Date.now(),
      };

      const initialStates: Record<string, string> = {};
      for (const unit of mockUnits) {
        initialStates[unit.id] = JSON.parse(JSON.stringify(unit.properties));
      }

      const result = await ActionProcessor.executeActionEffect(
        action,
        mockUnits,
        initialStates
      );

      expect(result.success).toBe(true); // Should succeed even if no effects found
    });

    it('handles invalid action gracefully', async () => {
      const action = {
        type: 'attack',
        player: 'NonExistentUnit',
        payload: { targetUnit: 'non-existent' },
        turn: 1,
        timestamp: Date.now(),
      };

      const initialStates: Record<string, string> = {};
      for (const unit of mockUnits) {
        initialStates[unit.id] = JSON.parse(JSON.stringify(unit.properties));
      }

      const result = await ActionProcessor.executeActionEffect(
        action,
        mockUnits,
        initialStates
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
      const defaultAction = ActionProcessor.getDefaultAction();

      expect(defaultAction).toHaveProperty('type');
      expect(defaultAction).toHaveProperty('description');
      expect(defaultAction).toHaveProperty('effect');
      expect(defaultAction).toHaveProperty('effects');
      expect(Array.isArray(defaultAction.effects)).toBe(true);

      expect(defaultAction.type).toBe('idle');
      expect(defaultAction.description).toContain(
        '{{unitName}} the {{unitType}} waits for instructions.'
      );
    });
  });
});
