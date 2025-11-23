import { describe, it, expect, beforeEach } from 'vitest';
import { StatTracker } from '../src/utils/StatTracker';
import { StatChange } from '../src/types';
import { BaseUnit } from '@atsu/atago';

describe('StatTracker', () => {
  let testUnits: BaseUnit[];

  beforeEach(() => {
    testUnits = [
      new BaseUnit('unit-1', 'TestWarrior', 'warrior', {
        health: { name: 'health', value: 100, baseValue: 100 },
        mana: { name: 'mana', value: 50, baseValue: 50 },
        attack: { name: 'attack', value: 20, baseValue: 20 },
        status: { name: 'status', value: 'alive', baseValue: 'alive' },
      }),
      new BaseUnit('unit-2', 'TestArcher', 'archer', {
        health: { name: 'health', value: 80, baseValue: 80 },
        mana: { name: 'mana', value: 30, baseValue: 30 },
        defense: { name: 'defense', value: 15, baseValue: 15 },
        status: { name: 'status', value: 'alive', baseValue: 'alive' },
      }),
    ];
  });

  describe('takeSnapshot', () => {
    it('creates a snapshot of unit properties', () => {
      const snapshot = StatTracker.takeSnapshot(testUnits);

      expect(snapshot).toHaveProperty('unit-1');
      expect(snapshot).toHaveProperty('unit-2');
      expect(snapshot['unit-1']).toEqual({
        health: { name: 'health', value: 100, baseValue: 100 },
        mana: { name: 'mana', value: 50, baseValue: 50 },
        attack: { name: 'attack', value: 20, baseValue: 20 },
        status: { name: 'status', value: 'alive', baseValue: 'alive' },
      });
    });

    it('handles empty units array', () => {
      const snapshot = StatTracker.takeSnapshot([]);

      expect(snapshot).toEqual({});
    });
  });

  describe('compareSnapshots', () => {
    it('detects property changes between snapshots', () => {
      const initialSnapshot = StatTracker.takeSnapshot(testUnits);

      // Simulate changes to the units
      testUnits[0].properties.health.value = 75; // Changed from 100 to 75
      testUnits[1].properties.mana.value = 35; // Changed from 30 to 35
      testUnits[1].properties.defense.value = 18; // Changed from 15 to 18

      const changes = StatTracker.compareSnapshots(initialSnapshot, testUnits);

      expect(changes).toHaveLength(3);

      // Find specific changes
      const healthChange = changes.find(c => c.propertyName === 'health');
      expect(healthChange).toBeDefined();
      if (healthChange) {
        expect(healthChange.oldValue).toBe(100);
        expect(healthChange.newValue).toBe(75);
        expect(healthChange.unitId).toBe('unit-1');
      }

      const manaChange = changes.find(c => c.propertyName === 'mana');
      expect(manaChange).toBeDefined();
      if (manaChange) {
        expect(manaChange.oldValue).toBe(30);
        expect(manaChange.newValue).toBe(35);
        expect(manaChange.unitId).toBe('unit-2');
      }

      const defenseChange = changes.find(c => c.propertyName === 'defense');
      expect(defenseChange).toBeDefined();
      if (defenseChange) {
        expect(defenseChange.oldValue).toBe(15);
        expect(defenseChange.newValue).toBe(18);
        expect(defenseChange.unitId).toBe('unit-2');
      }
    });

    it('returns empty array when no changes detected', () => {
      const initialSnapshot = StatTracker.takeSnapshot(testUnits);

      const changes = StatTracker.compareSnapshots(initialSnapshot, testUnits);

      expect(changes).toHaveLength(0);
    });

    it('handles units that are not in the initial snapshot', () => {
      const initialSnapshot = StatTracker.takeSnapshot([testUnits[0]]); // Only first unit in snapshot

      // Modify second unit (but it won't be tracked since it's not in initial snapshot)
      testUnits[0].properties.health.value = 90;
      testUnits[1].properties.mana.value = 35;

      const newUnit = new BaseUnit('unit-3', 'TestMage', 'mage', {
        health: { name: 'health', value: 60, baseValue: 60 },
        mana: { name: 'mana', value: 100, baseValue: 100 },
        status: { name: 'status', value: 'alive', baseValue: 'alive' },
      });
      const extendedUnits = [...testUnits, newUnit];

      const changes = StatTracker.compareSnapshots(
        initialSnapshot,
        extendedUnits
      );

      // Should only show changes for unit-1 (unit-2 and unit-3 weren't in initial snapshot)
      expect(changes).toHaveLength(1);
      const healthChange = changes.find(c => c.propertyName === 'health');
      expect(healthChange).toBeDefined();
      if (healthChange) {
        expect(healthChange.oldValue).toBe(100);
        expect(healthChange.newValue).toBe(90);
        expect(healthChange.unitId).toBe('unit-1');
      }
    });
  });

  describe('formatStatChanges', () => {
    it('formats stat changes as readable strings', () => {
      const changes: StatChange[] = [
        {
          propertyName: 'health',
          oldValue: 100,
          newValue: 85,
          unitId: 'unit-1',
          unitName: 'TestWarrior',
        },
        {
          propertyName: 'mana',
          oldValue: 50,
          newValue: 45,
          unitId: 'unit-1',
          unitName: 'TestWarrior',
        },
      ];

      const formatted = StatTracker.formatStatChanges(changes);

      expect(formatted).toEqual(['health: 100 -> 85', 'mana: 50 -> 45']);
    });

    it('returns empty array for no changes', () => {
      const formatted = StatTracker.formatStatChanges([]);

      expect(formatted).toEqual([]);
    });
  });

  describe('groupChangesByUnit', () => {
    it('groups stat changes by unit ID', () => {
      const changes = [
        {
          unitId: 'unit-1',
          unitName: 'Warrior',
          propertyName: 'health',
          oldValue: 100,
          newValue: 90,
        },
        {
          unitId: 'unit-1',
          unitName: 'Warrior',
          propertyName: 'attack',
          oldValue: 20,
          newValue: 25,
        },
        {
          unitId: 'unit-2',
          unitName: 'Archer',
          propertyName: 'mana',
          oldValue: 30,
          newValue: 35,
        },
      ];

      const grouped = StatTracker.groupChangesByUnit(changes);

      expect(grouped.size).toBe(2);
      expect(grouped.get('unit-1')).toHaveLength(2);
      expect(grouped.get('unit-2')).toHaveLength(1);

      const unit1Changes = grouped.get('unit-1')!;
      expect(unit1Changes.some(c => c.propertyName === 'health')).toBe(true);
      expect(unit1Changes.some(c => c.propertyName === 'attack')).toBe(true);

      const unit2Changes = grouped.get('unit-2')!;
      expect(unit2Changes.some(c => c.propertyName === 'mana')).toBe(true);
    });

    it('handles empty changes array', () => {
      const grouped = StatTracker.groupChangesByUnit([]);

      expect(grouped.size).toBe(0);
    });
  });
});
