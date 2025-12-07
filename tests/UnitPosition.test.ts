import { describe, it, expect, beforeEach } from 'vitest';
import { BaseUnit } from '@atsu/atago';
import { World, Map as ChoukaiMap, Position } from '@atsu/choukai';
import { UnitPosition } from '../src/utils/UnitPosition';

describe('UnitPosition', () => {
  let world: World;
  let units: BaseUnit[];

  beforeEach(() => {
    world = new World();
    // Create a test map
    const testMap = new ChoukaiMap(10, 10, 'Test Map');
    world.addMap(testMap);

    // Create test units with positions
    const unit1 = new BaseUnit('unit1', 'Warrior', 'warrior');
    unit1.setProperty('position', {
      unitId: 'unit1',
      mapId: 'Test Map',
      position: new Position(2, 2),
    });

    const unit2 = new BaseUnit('unit2', 'Archer', 'archer');
    unit2.setProperty('position', {
      unitId: 'unit2',
      mapId: 'Test Map',
      position: new Position(3, 2),
    });

    const unit3 = new BaseUnit('unit3', 'Mage', 'mage');
    unit3.setProperty('position', {
      unitId: 'unit3',
      mapId: 'Test Map',
      position: new Position(5, 5),
    });

    const unit4 = new BaseUnit('unit4', 'Healer', 'healer');
    unit4.setProperty('position', {
      unitId: 'unit4',
      mapId: 'Different Map',
      position: new Position(1, 1),
    });

    units = [unit1, unit2, unit3, unit4];
  });

  describe('getUnitAtPosition', () => {
    it('should return the unit at a specific position', () => {
      const unit = UnitPosition.getUnitAtPosition(units, 'Test Map', 2, 2);
      expect(unit).toBeDefined();
      expect(unit?.id).toBe('unit1');
      expect(unit?.name).toBe('Warrior');
    });

    it('should return undefined if no unit at position', () => {
      const unit = UnitPosition.getUnitAtPosition(units, 'Test Map', 0, 0);
      expect(unit).toBeUndefined();
    });

    it('should return undefined if map does not exist', () => {
      const unit = UnitPosition.getUnitAtPosition(
        units,
        'Nonexistent Map',
        2,
        2
      );
      expect(unit).toBeUndefined();
    });
  });

  describe('getUnitsInMap', () => {
    it('should return all units on a specific map', () => {
      const mapUnits = UnitPosition.getUnitsInMap(units, 'Test Map');
      expect(mapUnits).toHaveLength(3);
      expect(mapUnits.map(u => u.id)).toContain('unit1');
      expect(mapUnits.map(u => u.id)).toContain('unit2');
      expect(mapUnits.map(u => u.id)).toContain('unit3');
    });

    it('should return empty array if no units on map', () => {
      const mapUnits = UnitPosition.getUnitsInMap(units, 'Nonexistent Map');
      expect(mapUnits).toHaveLength(0);
    });
  });

  describe('getUnitsAtPosition and findCollisions', () => {
    it('returns all occupants at a tile', () => {
      // stack two units on same tile
      units[1]?.setProperty('position', {
        unitId: 'unit2',
        mapId: 'Test Map',
        position: new Position(2, 2),
      });

      const occupants = UnitPosition.getUnitsAtPosition(
        units,
        'Test Map',
        2,
        2
      );
      expect(occupants.map(u => u.id)).toEqual(['unit1', 'unit2']);
    });

    it('identifies collisions without blocking overlap', () => {
      units[1]?.setProperty('position', {
        unitId: 'unit2',
        mapId: 'Test Map',
        position: new Position(2, 2),
      });
      units[2]?.setProperty('position', {
        unitId: 'unit3',
        mapId: 'Test Map',
        position: new Position(2, 2),
      });

      const collisions = UnitPosition.findCollisions(units);
      expect(collisions).toHaveLength(1);
      expect(collisions[0]?.mapId).toBe('Test Map');
      expect(collisions[0]?.x).toBe(2);
      expect(collisions[0]?.y).toBe(2);
      expect(collisions[0]?.units.map(u => u.id).sort()).toEqual([
        'unit1',
        'unit2',
        'unit3',
      ]);
    });
  });

  describe('stepTowards', () => {
    it('moves horizontally toward target when farther on x axis', () => {
      const from = new Position(2, 2);
      const to = new Position(5, 3);
      const step = UnitPosition.stepTowards(world, 'Test Map', from, to);
      expect(step.x).toBe(3);
      expect(step.y).toBe(2);
    });

    it('moves vertically toward target when farther on y axis', () => {
      const from = new Position(5, 5);
      const to = new Position(3, 9);
      const step = UnitPosition.stepTowards(world, 'Test Map', from, to);
      expect(step.x).toBe(5);
      expect(step.y).toBe(6);
    });

    it('clamps within map bounds', () => {
      const from = new Position(0, 0);
      const to = new Position(-3, -4);
      const step = UnitPosition.stepTowards(world, 'Test Map', from, to);
      expect(step.x).toBe(0);
      expect(step.y).toBe(0);
    });
  });

  describe('getUnitsWithinRange', () => {
    it('should return units within range using Manhattan distance', () => {
      const unitsInRange = UnitPosition.getUnitsWithinRange(
        units,
        world,
        'unit1',
        2,
        true // Manhattan distance
      );
      expect(unitsInRange).toHaveLength(1); // unit2 is at (3,2) which is Manhattan distance 1 from (2,2)
      expect(unitsInRange[0]?.id).toBe('unit2');
    });

    it('should return no units if range is too small', () => {
      const unitsInRange = UnitPosition.getUnitsWithinRange(
        units,
        world,
        'unit1',
        0.5,
        true
      );
      expect(unitsInRange).toHaveLength(0);
    });

    it('should not return the reference unit itself', () => {
      const unitsInRange = UnitPosition.getUnitsWithinRange(
        units,
        world,
        'unit1',
        5,
        true
      );
      expect(unitsInRange).not.toContain(units.find(u => u.id === 'unit1'));
    });

    it('should not return units on different maps', () => {
      const unitsInRange = UnitPosition.getUnitsWithinRange(
        units,
        world,
        'unit1',
        10,
        true
      );
      expect(unitsInRange).not.toContain(units.find(u => u.id === 'unit4'));
    });
  });

  describe('getDistanceBetweenUnits', () => {
    it('should return correct Manhattan distance between units', () => {
      const distance = UnitPosition.getDistanceBetweenUnits(
        units,
        'unit1',
        'unit2',
        true // Manhattan distance
      );
      expect(distance).toBe(1); // Manhattan distance between (2,2) and (3,2) is 1
    });

    it('should return correct Euclidean distance between units', () => {
      const distance = UnitPosition.getDistanceBetweenUnits(
        units,
        'unit1',
        'unit2',
        false // Euclidean distance
      );
      expect(distance).toBeCloseTo(1); // Distance between (2,2) and (3,2) is 1
    });

    it('should return infinity if units are on different maps', () => {
      const distance = UnitPosition.getDistanceBetweenUnits(
        units,
        'unit1',
        'unit4',
        true
      );
      expect(distance).toBe(Infinity);
    });

    it('should return infinity if one of the units does not exist', () => {
      const distance = UnitPosition.getDistanceBetweenUnits(
        units,
        'unit1',
        'nonexistent',
        true
      );
      expect(distance).toBe(Infinity);
    });
  });

  describe('areUnitsAdjacent', () => {
    it('should return true for adjacent units', () => {
      const areAdjacent = UnitPosition.areUnitsAdjacent(
        units,
        world,
        'unit1',
        'unit2',
        true
      );
      expect(areAdjacent).toBe(true); // (2,2) and (3,2) are adjacent
    });

    it('should return false for non-adjacent units', () => {
      const areAdjacent = UnitPosition.areUnitsAdjacent(
        units,
        world,
        'unit1',
        'unit3',
        true
      );
      expect(areAdjacent).toBe(false); // (2,2) and (5,5) are not adjacent
    });

    it('should return false for units on different maps', () => {
      const areAdjacent = UnitPosition.areUnitsAdjacent(
        units,
        world,
        'unit1',
        'unit4',
        true
      );
      expect(areAdjacent).toBe(false); // Different maps
    });
  });

  describe('getAdjacentUnits', () => {
    it('should return adjacent units with diagonals allowed', () => {
      const adjacentUnits = UnitPosition.getAdjacentUnits(
        units,
        world,
        'unit1',
        true
      );
      expect(adjacentUnits).toHaveLength(1); // Only unit2 is adjacent
      expect(adjacentUnits[0]?.id).toBe('unit2');
    });

    it('should return adjacent units with diagonals disallowed', () => {
      const adjacentUnits = UnitPosition.getAdjacentUnits(
        units,
        world,
        'unit1',
        false // diagonals not allowed
      );
      expect(adjacentUnits).toHaveLength(1); // Only unit2 is adjacent (same result in this specific case)
      expect(adjacentUnits[0]?.id).toBe('unit2');
    });

    it('should return no units if no adjacent units exist', () => {
      const adjacentUnits = UnitPosition.getAdjacentUnits(
        units,
        world,
        'unit3',
        true
      );
      expect(adjacentUnits).toHaveLength(0);
    });
  });

  describe('diagonal functionality', () => {
    it('should detect diagonal adjacency when allowed', () => {
      // Create a specific test scenario where units are diagonally adjacent
      const unitA = new BaseUnit('unitA', 'UnitA', 'warrior');
      unitA.setProperty('position', {
        unitId: 'unitA',
        mapId: 'Test Map',
        position: new Position(2, 2),
      });

      const unitB = new BaseUnit('unitB', 'UnitB', 'archer');
      unitB.setProperty('position', {
        unitId: 'unitB',
        mapId: 'Test Map',
        position: new Position(3, 3), // Diagonally adjacent to unitA
      });

      const diagonalUnits = [unitA, unitB];

      // With diagonals allowed, they should be adjacent
      const areAdjacentWithDiagonal = UnitPosition.areUnitsAdjacent(
        diagonalUnits,
        world,
        'unitA',
        'unitB',
        true
      );
      expect(areAdjacentWithDiagonal).toBe(true);

      // Get adjacent positions with diagonals allowed
      const positionsWithDiagonal = UnitPosition.getAdjacentPositions(
        world,
        'Test Map',
        2,
        2,
        true
      );
      const diagonalPos = positionsWithDiagonal.find(
        p => p.x === 3 && p.y === 3
      );
      expect(diagonalPos).toBeDefined();
    });

    it('should not detect diagonal adjacency when disallowed', () => {
      // Create a specific test scenario where units are diagonally adjacent
      const unitA = new BaseUnit('unitA', 'UnitA', 'warrior');
      unitA.setProperty('position', {
        unitId: 'unitA',
        mapId: 'Test Map',
        position: new Position(2, 2),
      });

      const unitB = new BaseUnit('unitB', 'UnitB', 'archer');
      unitB.setProperty('position', {
        unitId: 'unitB',
        mapId: 'Test Map',
        position: new Position(3, 3), // Diagonally adjacent to unitA
      });

      const diagonalUnits = [unitA, unitB];

      // With diagonals disallowed, they should NOT be adjacent
      const areAdjacentWithoutDiagonal = UnitPosition.areUnitsAdjacent(
        diagonalUnits,
        world,
        'unitA',
        'unitB',
        false
      );
      expect(areAdjacentWithoutDiagonal).toBe(false);

      // Get adjacent positions without diagonals allowed
      const positionsWithoutDiagonal = UnitPosition.getAdjacentPositions(
        world,
        'Test Map',
        2,
        2,
        false
      );
      const diagonalPos = positionsWithoutDiagonal.find(
        p => p.x === 3 && p.y === 3
      );
      expect(diagonalPos).toBeUndefined();
    });

    it('should return different adjacent units based on diagonal setting', () => {
      // Create a scenario with cardinal-only and diagonal adjacent units
      const centerUnit = new BaseUnit('center', 'Center', 'warrior');
      centerUnit.setProperty('position', {
        unitId: 'center',
        mapId: 'Test Map',
        position: new Position(5, 5),
      });

      const northUnit = new BaseUnit('north', 'North', 'archer');
      northUnit.setProperty('position', {
        unitId: 'north',
        mapId: 'Test Map',
        position: new Position(5, 4), // North of center (cardinal)
      });

      const neUnit = new BaseUnit('ne', 'Northeast', 'mage');
      neUnit.setProperty('position', {
        unitId: 'ne',
        mapId: 'Test Map',
        position: new Position(6, 4), // Northeast of center (diagonal)
      });

      const eastUnit = new BaseUnit('east', 'East', 'healer');
      eastUnit.setProperty('position', {
        unitId: 'east',
        mapId: 'Test Map',
        position: new Position(6, 5), // East of center (cardinal)
      });

      const allUnits = [centerUnit, northUnit, neUnit, eastUnit];

      // With diagonals allowed, should get 3 adjacent units (N, NE, E)
      const withDiagonals = UnitPosition.getAdjacentUnits(
        allUnits,
        world,
        'center',
        true
      );
      expect(withDiagonals).toHaveLength(3);
      const withDiagonalIds = withDiagonals.map(u => u.id).sort();
      expect(withDiagonalIds).toEqual(['east', 'ne', 'north']);

      // With diagonals disallowed, should get 2 adjacent units (N, E) - NE excluded
      const withoutDiagonals = UnitPosition.getAdjacentUnits(
        allUnits,
        world,
        'center',
        false
      );
      expect(withoutDiagonals).toHaveLength(2);
      const withoutDiagonalIds = withoutDiagonals.map(u => u.id).sort();
      expect(withoutDiagonalIds).toEqual(['east', 'north']);
    });
  });
});
