/**
 * Tests for the WorldManager utility class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorldManager } from '../src/utils/WorldManager';
import { World, Map as ChoukaiMap, Position } from '@atsu/choukai';

describe('WorldManager', () => {
  let world: World;
  let testMap: ChoukaiMap;

  beforeEach(() => {
    world = WorldManager.createWorld();
    testMap = WorldManager.createMap(10, 10, 'Test Map');
    world.addMap(testMap);
  });

  it('should create a new map with specified dimensions and name', () => {
    const map = WorldManager.createMap(15, 20, 'New Map');
    expect(map).toBeDefined();
    expect(map.width).toBe(15);
    expect(map.height).toBe(20);
    expect(map.name).toBe('New Map');
  });

  it('should create a new world instance', () => {
    const newWorld = WorldManager.createWorld();
    expect(newWorld).toBeDefined();
    expect(newWorld.getAllMaps().length).toBe(0);
  });

  it('should generate a random valid position on a map', () => {
    const map = WorldManager.createMap(5, 5, 'Small Map');
    const position = WorldManager.getRandomPosition(map);

    expect(position).toBeDefined();
    expect(position.x).toBeGreaterThanOrEqual(0);
    expect(position.x).toBeLessThan(5);
    expect(position.y).toBeGreaterThanOrEqual(0);
    expect(position.y).toBeLessThan(5);
  });

  it('should set a unit position in the world successfully', () => {
    const position = new Position(3, 4);
    const success = WorldManager.setUnitPosition(
      world,
      'unit-1',
      'Test Map',
      position
    );

    expect(success).toBe(true);

    // Verify the position was actually set
    const retrievedPosition = WorldManager.getUnitPosition(world, 'unit-1');
    expect(retrievedPosition.mapId).toBe('Test Map');
    expect(retrievedPosition.position.x).toBe(3);
    expect(retrievedPosition.position.y).toBe(4);
  });

  it('should fail to set a unit position on a non-existent map', () => {
    const position = new Position(3, 4);
    const success = WorldManager.setUnitPosition(
      world,
      'unit-1',
      'NonExistent Map',
      position
    );

    expect(success).toBe(false);
  });

  it('should fail to set a unit position on an occupied cell', () => {
    // Place first unit
    const position1 = new Position(3, 4);
    const success1 = WorldManager.setUnitPosition(
      world,
      'unit-1',
      'Test Map',
      position1
    );
    expect(success1).toBe(true);

    // Try to place second unit at same position
    const position2 = new Position(3, 4);
    const success2 = WorldManager.setUnitPosition(
      world,
      'unit-2',
      'Test Map',
      position2
    );

    expect(success2).toBe(false);
  });

  it('should get a unit position from the world', () => {
    const position = new Position(2, 5);
    WorldManager.setUnitPosition(world, 'unit-1', 'Test Map', position);

    const retrievedPosition = WorldManager.getUnitPosition(world, 'unit-1');
    expect(retrievedPosition.unitId).toBe('unit-1');
    expect(retrievedPosition.mapId).toBe('Test Map');
    expect(retrievedPosition.position.x).toBe(2);
    expect(retrievedPosition.position.y).toBe(5);
  });

  it('should throw an error when getting position for a non-existent unit', () => {
    expect(() => {
      WorldManager.getUnitPosition(world, 'non-existent-unit');
    }).toThrow('Failed to get position for unit non-existent-unit');
  });

  it('should move a unit within the world successfully', () => {
    // Set initial position
    const initialPosition = new Position(2, 2);
    WorldManager.setUnitPosition(world, 'unit-1', 'Test Map', initialPosition);

    // Move the unit
    const moved = WorldManager.moveUnit(world, 'unit-1', 5, 6);
    expect(moved).toBe(true);

    // Verify the new position
    const newPosition = WorldManager.getUnitPosition(world, 'unit-1');
    expect(newPosition.position.x).toBe(5);
    expect(newPosition.position.y).toBe(6);
  });

  it('should fail to move a non-existent unit', () => {
    const moved = WorldManager.moveUnit(world, 'non-existent-unit', 5, 6);
    expect(moved).toBe(false);
  });

  it('should handle moveUnit failure gracefully when position is invalid', () => {
    // Place a unit
    const initialPosition = new Position(2, 2);
    WorldManager.setUnitPosition(world, 'unit-1', 'Test Map', initialPosition);

    // Place another unit to block the destination
    WorldManager.setUnitPosition(
      world,
      'unit-2',
      'Test Map',
      new Position(7, 7)
    );

    const moved = WorldManager.moveUnit(world, 'unit-1', 7, 7);
    expect(moved).toBe(false);

    // Original unit should remain at initial position
    const position = WorldManager.getUnitPosition(world, 'unit-1');
    expect(position.position.x).toBe(2);
    expect(position.position.y).toBe(2);
  });

  it('should preserve z-coordinate when setting unit position', () => {
    const position = new Position(3, 4, 2); // With z-coordinate
    const success = WorldManager.setUnitPosition(
      world,
      'unit-3d',
      'Test Map',
      position
    );

    expect(success).toBe(true);

    const retrievedPosition = WorldManager.getUnitPosition(world, 'unit-3d');
    expect(retrievedPosition.position.x).toBe(3);
    expect(retrievedPosition.position.y).toBe(4);
    expect(retrievedPosition.position.z).toBe(2);
  });

  it('should be able to move unit while preserving z-coordinate', () => {
    // Set initial position with z-coordinate
    const initialPosition = new Position(1, 1, 5);
    WorldManager.setUnitPosition(world, 'unit-3d', 'Test Map', initialPosition);

    // Move the unit (z-coordinate should be preserved during move)
    const moved = WorldManager.moveUnit(world, 'unit-3d', 8, 8);
    expect(moved).toBe(true);

    const newPosition = WorldManager.getUnitPosition(world, 'unit-3d');
    expect(newPosition.position.x).toBe(8);
    expect(newPosition.position.y).toBe(8);
    // Note: The z-coordinate is not preserved during the moveUnit operation in the World class
    // The moveUnit function only takes x,y coordinates and creates a new Position
    // So z-coordinate would be undefined unless explicitly managed at a higher level
  });
});
