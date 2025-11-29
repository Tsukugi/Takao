/**
 * Tests for the MapSerializer utility class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Map as ChoukaiMap } from '@atsu/choukai';
import { MapSerializer } from '../src/utils/MapSerializer';

describe('MapSerializer', () => {
  let testMap: ChoukaiMap;

  beforeEach(() => {
    testMap = new ChoukaiMap(4, 3, 'Test Map');
    // Add some terrain to the map
    testMap.setTerrain(0, 0, 'water');
    testMap.setTerrain(1, 0, 'mountain');
    testMap.setTerrain(2, 0, 'forest');
    testMap.setTerrain(0, 1, 'desert');
    testMap.setTerrain(1, 1, 'road');
    // Add some units
    testMap.placeUnit('PLAYER', 0, 0);
    testMap.placeUnit('ENEMY', 1, 1);
  });

  it('should serialize a map correctly', () => {
    const serialized = MapSerializer.serialize(testMap);

    expect(serialized).toBeDefined();
    expect(serialized.name).toBe('Test Map');
    expect(serialized.width).toBe(4);
    expect(serialized.height).toBe(3);
    expect(serialized.cells).toBeDefined();
    expect(serialized.cells).toBeInstanceOf(Array);
    expect(serialized.cells.length).toBe(3); // height
    expect(serialized.cells[0]).toBeInstanceOf(Array);
    expect(serialized.cells[0].length).toBe(4); // width
  });

  it('should serialize and deserialize a map preserving data', () => {
    // Serialize the original map
    const serialized = MapSerializer.serialize(testMap);

    // Deserialize to create a new map
    const deserialized = MapSerializer.deserialize(serialized);

    // Check that the deserialized map has the same properties
    expect(deserialized.name).toBe('Test Map');
    expect(deserialized.width).toBe(4);
    expect(deserialized.height).toBe(3);

    // Check that terrain is preserved
    expect(deserialized.getTerrain(0, 0)).toBe('water');
    expect(deserialized.getTerrain(1, 0)).toBe('mountain');
    expect(deserialized.getTerrain(2, 0)).toBe('forest');
    expect(deserialized.getTerrain(0, 1)).toBe('desert');
    expect(deserialized.getTerrain(1, 1)).toBe('road');
  });

  it('should serialize and deserialize multiple maps correctly', () => {
    // Create multiple maps
    const map1 = new ChoukaiMap(3, 3, 'Map 1');
    map1.setTerrain(0, 0, 'water');
    const map2 = new ChoukaiMap(2, 2, 'Map 2');
    map2.setTerrain(1, 1, 'mountain');

    const maps = [map1, map2];

    // Serialize multiple maps
    const serializedMaps = MapSerializer.serializeMany(maps);
    expect(serializedMaps.length).toBe(2);

    // Deserialize multiple maps
    const deserializedMaps = MapSerializer.deserializeMany(serializedMaps);
    expect(deserializedMaps.length).toBe(2);

    // Check that the first map is correctly deserialized
    expect(deserializedMaps[0].name).toBe('Map 1');
    expect(deserializedMaps[0].width).toBe(3);
    expect(deserializedMaps[0].height).toBe(3);
    expect(deserializedMaps[0].getTerrain(0, 0)).toBe('water');

    // Check that the second map is correctly deserialized
    expect(deserializedMaps[1].name).toBe('Map 2');
    expect(deserializedMaps[1].width).toBe(2);
    expect(deserializedMaps[1].height).toBe(2);
    expect(deserializedMaps[1].getTerrain(1, 1)).toBe('mountain');
  });

  it('should handle map with default configuration during serialization', () => {
    const mapWithConfig = new ChoukaiMap(5, 5, 'Config Test Map');
    const serialized = MapSerializer.serialize(mapWithConfig);

    expect(serialized.name).toBe('Config Test Map');
    expect(serialized.width).toBe(5);
    expect(serialized.height).toBe(5);
  });

  it('should preserve all cell data during serialization/deserialization', () => {
    // Create a map and populate with different terrain types
    const originalMap = new ChoukaiMap(3, 2, 'Complete Test Map');
    originalMap.setTerrain(0, 0, 'water');
    originalMap.setTerrain(1, 0, 'mountain');
    originalMap.setTerrain(2, 0, 'forest');
    originalMap.setTerrain(0, 1, 'desert');
    originalMap.setTerrain(1, 1, 'road');
    originalMap.setTerrain(2, 1, 'grass');

    // Place some units
    originalMap.placeUnit('UNIT1', 0, 0);
    originalMap.placeUnit('UNIT2', 1, 0);

    // Serialize and deserialize
    const serialized = MapSerializer.serialize(originalMap);
    const deserialized = MapSerializer.deserialize(serialized);

    // Verify all terrain is preserved
    expect(deserialized.getTerrain(0, 0)).toBe('water');
    expect(deserialized.getTerrain(1, 0)).toBe('mountain');
    expect(deserialized.getTerrain(2, 0)).toBe('forest');
    expect(deserialized.getTerrain(0, 1)).toBe('desert');
    expect(deserialized.getTerrain(1, 1)).toBe('road');
    expect(deserialized.getTerrain(2, 1)).toBe('grass');
  });

  it('should handle empty maps during serialization/deserialization', () => {
    // Create an empty map
    const emptyMap = new ChoukaiMap(2, 2, 'Empty Map');

    // Serialize and deserialize
    const serialized = MapSerializer.serialize(emptyMap);
    const deserialized = MapSerializer.deserialize(serialized);

    // Check properties
    expect(deserialized.name).toBe('Empty Map');
    expect(deserialized.width).toBe(2);
    expect(deserialized.height).toBe(2);

    // Check that all cells are grass (default)
    for (let y = 0; y < deserialized.height; y++) {
      for (let x = 0; x < deserialized.width; x++) {
        expect(deserialized.getTerrain(x, y)).toBe('grass');
      }
    }
  });

  it('should return different instances after deserialization', () => {
    const serialized = MapSerializer.serialize(testMap);
    const deserialized1 = MapSerializer.deserialize(serialized);
    const deserialized2 = MapSerializer.deserialize(serialized);

    // Different instances but same data
    expect(deserialized1).not.toBe(deserialized2);
    expect(deserialized1.name).toBe(deserialized2.name);
    expect(deserialized1.width).toBe(deserialized2.width);
    expect(deserialized1.height).toBe(deserialized2.height);
  });

  it('should handle large maps without errors', () => {
    // Create a larger map
    const largeMap = new ChoukaiMap(20, 15, 'Large Test Map');

    // Set some terrain in predictable patterns
    for (let y = 0; y < largeMap.height; y++) {
      for (let x = 0; x < largeMap.width; x++) {
        if (x % 2 === 0 && y % 2 === 0) {
          largeMap.setTerrain(x, y, 'water');
        } else if (x % 3 === 0) {
          largeMap.setTerrain(x, y, 'mountain');
        } else if (y % 3 === 0) {
          largeMap.setTerrain(x, y, 'forest');
        } else {
          largeMap.setTerrain(x, y, 'grass');
        }
      }
    }

    // Serialize and deserialize
    const serialized = MapSerializer.serialize(largeMap);
    const deserialized = MapSerializer.deserialize(serialized);

    // Verify dimensions
    expect(deserialized.width).toBe(20);
    expect(deserialized.height).toBe(15);

    // Check a few specific cells to ensure data was preserved
    expect(deserialized.getTerrain(0, 0)).toBe('water'); // 0,0 should be water
    expect(deserialized.getTerrain(2, 2)).toBe('water'); // 2,2 should be water
  });
});
