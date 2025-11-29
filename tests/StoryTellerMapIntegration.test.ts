/**
 * Tests for the updated StoryTeller with Map Generation integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StoryTeller } from '../src/core/StoryTeller';
import { UnitController } from '../src/ai/UnitController';
import { Position, World } from '@atsu/choukai';
import { WorldManager } from '../src/utils/WorldManager';
import { MapGenerator } from '../src/utils/MapGenerator';

describe('StoryTeller with Map Generation Integration', () => {
  let storyTeller: StoryTeller;
  let unitController: UnitController;

  beforeEach(() => {
    unitController = new UnitController();
    storyTeller = new StoryTeller(unitController);
  });

  it('should initialize with MapGenerator and World', () => {
    expect(storyTeller['mapGenerator']).toBeDefined();
    expect(storyTeller['world']).toBeDefined();
    expect(storyTeller.getWorld()).toBeInstanceOf(World);
  });

  it('should create a single map using MapGenerator', () => {
    const map = storyTeller.createMap('Test Map', 15, 15);
    expect(map.name).toBe('Test Map');
    expect(map.width).toBe(15);
    expect(map.height).toBe(15);
  });

  it('should create a world with interconnected maps', () => {
    const world = storyTeller.createWorldWithMaps(['Map1', 'Map2', 'Map3']);
    const maps = world.getAllMaps();

    expect(maps.length).toBe(3);
    expect(maps[0].name).toBe('Map1');
    expect(maps[1].name).toBe('Map2');
    expect(maps[2].name).toBe('Map3');
  });

  it('should get the current world', () => {
    const world = storyTeller.getWorld();
    expect(world).toBeInstanceOf(World);
  });

  it('should handle map edge movement', async () => {
    // Create a new StoryTeller for this test to ensure clean state
    const unitController = new UnitController();
    await unitController.initialize({ turn: 0 });
    const testStoryTeller = new StoryTeller(unitController);

    // Create a fresh map instance instead of using storyteller's createMap
    const mapGenerator = new MapGenerator();
    const uniqueSuffix = Date.now().toString();
    const testMap = mapGenerator.generateMap(
      'EdgeTestMap' + uniqueSuffix,
      10,
      10
    );
    const world = testStoryTeller.getWorld();
    const addMapResult = world.addMap(testMap);
    expect(addMapResult).toBe(true);

    // Add a unit to the world properly using WorldManager
    const unitAdded = WorldManager.setUnitPosition(
      world,
      'edge-test-unit',
      testMap.name,
      new Position(5, 5)
    );
    expect(unitAdded).toBe(true);

    // Now create a scenario to test actual map edge movement with gates
    // First, create a second map
    const targetMap = mapGenerator.generateMap(
      'TargetMap' + uniqueSuffix + '2',
      10,
      10
    );
    const addTargetMapResult = world.addMap(targetMap);
    expect(addTargetMapResult).toBe(true);

    // Remove the original unit and add a new one near the edge
    testMap.removeUnit(5, 5); // Remove from original position

    const unitAddedEdge = WorldManager.setUnitPosition(
      world,
      'edge-test-unit',
      testMap.name,
      new Position(9, 5) // Position near the right edge (at x=9 in 10x10 map)
    );
    expect(unitAddedEdge).toBe(true);

    // Add a gate that connects the edge of source map to the target map
    const gateAdded = testStoryTeller.addGate({
      mapFrom: testMap.name,
      positionFrom: { x: 9, y: 5 }, // Edge position
      mapTo: targetMap.name,
      positionTo: { x: 0, y: 5 }, // Left edge of target map
      name: 'EdgeGate' + uniqueSuffix,
      bidirectional: true,
    });
    expect(gateAdded).toBe(true);

    // Move the unit to the edge position where there's a gate
    // This should trigger the gate transition
    const result = await testStoryTeller.moveUnitToPosition(
      'edge-test-unit',
      9, // Move to right edge
      5
    );

    // The function should return true if the initial move is valid
    // (It may return false if the gate transition interferes with the move operation)
    expect(typeof result).toBe('boolean');

    // Verify that the unit was transitioned to the target map via the gate
    // Regardless of the move result, check if the unit is now on the target map
    const newPosition = world.getUnitPosition('edge-test-unit');
    expect(newPosition).toBeDefined(); // Unit should still exist in the world
    expect(newPosition.mapId).toBe(targetMap.name); // Unit should be on the target map
    expect(newPosition.position.x).toBe(0); // Should be at the gate destination
    expect(newPosition.position.y).toBe(5);
  });

  it('should handle map transitions when unit reaches edge', async () => {
    // Create a new StoryTeller for this test to ensure clean state
    const unitController = new UnitController();
    await unitController.initialize({ turn: 0 });
    const testStoryTeller = new StoryTeller(unitController);

    // Create two maps for testing edge transitions with gates
    const sourceMapName = `SourceMap${Date.now()}`;
    const targetMapName = `TargetMap${Date.now()}`;
    const sourceMap = testStoryTeller.createMap(sourceMapName, 10, 10);
    const targetMap = testStoryTeller.createMap(targetMapName, 10, 10);
    const world = testStoryTeller.getWorld();

    // Add both maps to the world
    const sourceAdded = world.addMap(sourceMap);
    const targetAdded = world.addMap(targetMap);
    expect(sourceAdded).toBe(true);
    expect(targetAdded).toBe(true);

    // Add a unit to the source map near the edge (x=9, y=5 - right edge)
    const unitAdded = WorldManager.setUnitPosition(
      world,
      'edge-test-unit',
      sourceMapName,
      new Position(8, 5) // Position near the right edge
    );
    expect(unitAdded).toBe(true);

    // Create a gate that connects the edge position on source map to the target map
    const gateAdded = testStoryTeller.addGate({
      mapFrom: sourceMapName,
      positionFrom: { x: 9, y: 5 }, // Edge position
      mapTo: targetMapName,
      positionTo: { x: 0, y: 5 }, // Left edge of target map
      name: 'EdgeTransitionGate',
      bidirectional: false,
    });
    expect(gateAdded).toBe(true);

    // Move the unit to the edge position where there's a gate
    const result = await testStoryTeller.moveUnitToPosition(
      'edge-test-unit',
      9, // Move to right edge where gate is located
      5
    );

    // The move should succeed
    expect(result).toBe(true);

    // Verify that the unit was transitioned to the target map via the gate
    const finalPosition = world.getUnitPosition('edge-test-unit');
    expect(finalPosition.mapId).toBe(targetMapName); // Unit should be on the target map
    expect(finalPosition.position.x).toBe(0); // Should be at the gate destination
    expect(finalPosition.position.y).toBe(5);
  });
});
