import {
  World as ChoukaiWorld,
  Map as ChoukaiMap,
  IMapConfig,
} from '@atsu/choukai';
import {
  WorldSnapshotSerializer,
  type SerializableWorldSnapshot,
} from '../src/utils/WorldSnapshotSerializer';
import { describe, it, expect } from 'vitest';

describe('WorldSnapshotSerializer', () => {
  describe('serialize', () => {
    it('should serialize a world with a single map', () => {
      const world = new ChoukaiWorld();
      const map = new ChoukaiMap(3, 3, 'Test Map');

      // Set different terrains for each cell
      map.setTerrain(0, 0, 'grass');
      map.setTerrain(1, 0, 'water');
      map.setTerrain(2, 0, 'mountain');
      map.setTerrain(0, 1, 'forest');
      map.setTerrain(1, 1, 'desert');
      map.setTerrain(2, 1, 'road');
      map.setTerrain(0, 2, 'swamp');
      map.setTerrain(1, 2, 'snow');
      map.setTerrain(2, 2, 'sand');

      world.addMap(map);

      const result = WorldSnapshotSerializer.serialize(world);

      expect(result.maps).toHaveLength(1);
      const snapshot = result.maps[0];
      expect(snapshot.name).toBe('Test Map');
      expect(snapshot.width).toBe(3);
      expect(snapshot.height).toBe(3);
      expect(snapshot.renderedMap).toEqual(['.~^', 't#=', ':*-']);
    });

    it('should handle world with multiple maps', () => {
      const world = new ChoukaiWorld();

      // Add first map
      const map1 = new ChoukaiMap(2, 2, 'Map 1');
      map1.setTerrain(0, 0, 'grass');
      map1.setTerrain(1, 0, 'water');
      map1.setTerrain(0, 1, 'forest');
      map1.setTerrain(1, 1, 'mountain');
      world.addMap(map1);

      // Add second map
      const map2 = new ChoukaiMap(2, 1, 'Map 2');
      map2.setTerrain(0, 0, 'desert');
      map2.setTerrain(1, 0, 'road');
      world.addMap(map2);

      const result = WorldSnapshotSerializer.serialize(world);

      expect(result.maps).toHaveLength(2);
      expect(result.maps[0].name).toBe('Map 1');
      expect(result.maps[0].width).toBe(2);
      expect(result.maps[0].height).toBe(2);
      expect(result.maps[0].renderedMap).toEqual(['.~', 't^']);

      expect(result.maps[1].name).toBe('Map 2');
      expect(result.maps[1].width).toBe(2);
      expect(result.maps[1].height).toBe(1);
      expect(result.maps[1].renderedMap).toEqual(['#=']);
    });

    it('should serialize a world with empty maps', () => {
      const world = new ChoukaiWorld();
      const map = new ChoukaiMap(0, 0, 'Empty Map');
      world.addMap(map);

      const result = WorldSnapshotSerializer.serialize(world);

      expect(result.maps).toHaveLength(1);
      const snapshot = result.maps[0];
      expect(snapshot.name).toBe('Empty Map');
      expect(snapshot.width).toBe(0);
      expect(snapshot.height).toBe(0);
      expect(snapshot.renderedMap).toEqual([]);
    });

    it('should serialize map configurations if they exist', () => {
      const world = new ChoukaiWorld();
      const config: IMapConfig = { defaultMovementCost: 2, wrapEdges: true };
      const map = new ChoukaiMap(2, 2, 'Configured Map', config);

      // Set some terrains
      map.setTerrain(0, 0, 'grass');
      map.setTerrain(1, 0, 'forest');
      map.setTerrain(0, 1, 'water');
      map.setTerrain(1, 1, 'mountain');

      world.addMap(map);

      const result = WorldSnapshotSerializer.serialize(world);

      expect(result.maps).toHaveLength(1);
      // The map configuration might include default values merged with provided config
      expect(result.maps[0].config).toMatchObject(config); // Use toMatchObject to check partial match
    });
  });

  describe('deserialize', () => {
    it('should deserialize a serialized world snapshot back to world', () => {
      const originalWorld = new ChoukaiWorld();
      const originalMap = new ChoukaiMap(3, 2, 'Test Map');

      // Set terrains for the original map
      originalMap.setTerrain(0, 0, 'grass');
      originalMap.setTerrain(1, 0, 'water');
      originalMap.setTerrain(2, 0, 'mountain');
      originalMap.setTerrain(0, 1, 'forest');
      originalMap.setTerrain(1, 1, 'desert');
      originalMap.setTerrain(2, 1, 'road');

      originalWorld.addMap(originalMap);

      // Serialize
      const serialized = WorldSnapshotSerializer.serialize(originalWorld);

      // Deserialize
      const deserializedWorld = WorldSnapshotSerializer.deserialize(serialized);

      // Check that the deserialized world has the correct map
      const allMaps = deserializedWorld.getAllMaps();
      expect(allMaps).toHaveLength(1);
      const deserializedMap = allMaps[0];

      expect(deserializedMap.name).toBe('Test Map');
      expect(deserializedMap.width).toBe(3);
      expect(deserializedMap.height).toBe(2);

      // Check that terrains are properly restored
      expect(deserializedMap.getCell(0, 0)?.terrain).toBe('grass');
      expect(deserializedMap.getCell(1, 0)?.terrain).toBe('water');
      expect(deserializedMap.getCell(2, 0)?.terrain).toBe('mountain');
      expect(deserializedMap.getCell(0, 1)?.terrain).toBe('forest');
      expect(deserializedMap.getCell(1, 1)?.terrain).toBe('desert');
      expect(deserializedMap.getCell(2, 1)?.terrain).toBe('road');
    });

    it('should handle multiple maps during deserialization', () => {
      // Create a serialized snapshot with multiple maps
      const snapshot: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'First Map',
            width: 2,
            height: 2,
            renderedMap: ['..', '~~'],
          },
          {
            name: 'Second Map',
            width: 1,
            height: 1,
            renderedMap: ['#'],
          },
        ],
      };

      const world = WorldSnapshotSerializer.deserialize(snapshot);

      const maps = world.getAllMaps();
      expect(maps).toHaveLength(2);

      expect(maps[0].name).toBe('First Map');
      expect(maps[0].width).toBe(2);
      expect(maps[0].height).toBe(2);
      expect(maps[0].getCell(0, 0)?.terrain).toBe('grass');
      expect(maps[0].getCell(1, 1)?.terrain).toBe('water');

      expect(maps[1].name).toBe('Second Map');
      expect(maps[1].width).toBe(1);
      expect(maps[1].height).toBe(1);
      expect(maps[1].getCell(0, 0)?.terrain).toBe('desert');
    });

    it('should handle map configurations during deserialization', () => {
      const config = { theme: 'ocean', enemies: 5 };
      const snapshot: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Configured Map',
            width: 1,
            height: 1,
            config,
            renderedMap: ['~'],
          },
        ],
      };

      const world = WorldSnapshotSerializer.deserialize(snapshot);

      const maps = world.getAllMaps();
      expect(maps).toHaveLength(1);
      expect(maps[0].name).toBe('Configured Map');
    });

    it('should handle empty map during deserialization', () => {
      const snapshot: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Empty Map',
            width: 0,
            height: 0,
            renderedMap: [],
          },
        ],
      };

      const world = WorldSnapshotSerializer.deserialize(snapshot);

      const maps = world.getAllMaps();
      expect(maps).toHaveLength(1);
      expect(maps[0].name).toBe('Empty Map');
      expect(maps[0].width).toBe(0);
      expect(maps[0].height).toBe(0);
    });
  });

  describe('getTerrainTypeFromSymbol', () => {
    it('should correctly identify terrain type from symbol', () => {
      // Test all terrain symbols
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol('.')
      ).toBe('grass');
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol('~')
      ).toBe('water');
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol('^')
      ).toBe('mountain');
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol('t')
      ).toBe('forest');
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol('#')
      ).toBe('desert');
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol('=')
      ).toBe('road');
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol(':')
      ).toBe('swamp');
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol('*')
      ).toBe('snow');
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol('-')
      ).toBe('sand');
    });

    it('should return null for unknown symbols', () => {
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol('?')
      ).toBeNull();
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol('X')
      ).toBeNull();
      expect(
        (WorldSnapshotSerializer as any).getTerrainTypeFromSymbol('')
      ).toBeNull();
    });
  });

  describe('compareSnapshots', () => {
    it('should return true for identical snapshots', () => {
      const snapshot1: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Map 1',
            width: 2,
            height: 2,
            renderedMap: ['..', '~~'],
          },
        ],
      };

      const snapshot2: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Map 1',
            width: 2,
            height: 2,
            renderedMap: ['..', '~~'],
          },
        ],
      };

      const result = WorldSnapshotSerializer.compareSnapshots(
        snapshot1,
        snapshot2
      );
      expect(result).toBe(true);
    });

    it('should return false for snapshots with different number of maps', () => {
      const snapshot1: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Map 1',
            width: 2,
            height: 2,
            renderedMap: ['..', '~~'],
          },
        ],
      };

      const snapshot2: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Map 1',
            width: 2,
            height: 2,
            renderedMap: ['..', '~~'],
          },
          {
            name: 'Map 2',
            width: 1,
            height: 1,
            renderedMap: ['#'],
          },
        ],
      };

      const result = WorldSnapshotSerializer.compareSnapshots(
        snapshot1,
        snapshot2
      );
      expect(result).toBe(false);
    });

    it('should return false for snapshots with different map properties', () => {
      const snapshot1: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Map 1',
            width: 2,
            height: 2,
            renderedMap: ['..', '~~'],
          },
        ],
      };

      const snapshot2: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Different Name', // Different name
            width: 2,
            height: 2,
            renderedMap: ['..', '~~'],
          },
        ],
      };

      const result = WorldSnapshotSerializer.compareSnapshots(
        snapshot1,
        snapshot2
      );
      expect(result).toBe(false);
    });

    it('should return false for snapshots with different map dimensions', () => {
      const snapshot1: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Map 1',
            width: 2,
            height: 2,
            renderedMap: ['..', '~~'],
          },
        ],
      };

      const snapshot2: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Map 1',
            width: 3, // Different width
            height: 2,
            renderedMap: ['..', '~~'],
          },
        ],
      };

      const result = WorldSnapshotSerializer.compareSnapshots(
        snapshot1,
        snapshot2
      );
      expect(result).toBe(false);
    });

    it('should return false for snapshots with different rendered maps', () => {
      const snapshot1: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Map 1',
            width: 2,
            height: 2,
            renderedMap: ['..', '~~'],
          },
        ],
      };

      const snapshot2: SerializableWorldSnapshot = {
        maps: [
          {
            name: 'Map 1',
            width: 2,
            height: 2,
            renderedMap: ['~~', '..'], // Different order
          },
        ],
      };

      const result = WorldSnapshotSerializer.compareSnapshots(
        snapshot1,
        snapshot2
      );
      expect(result).toBe(false);
    });
  });
});
