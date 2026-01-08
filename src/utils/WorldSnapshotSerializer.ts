/**
 * World snapshot serialization for efficient storage of game state
 * Stores maps as compressed string representations instead of individual cells
 */

import {
  World as ChoukaiWorld,
  Map as ChoukaiMap,
  type TerrainType,
  type IMapConfig,
} from '@atsu/choukai';

/**
 * Serializable world snapshot data structure
 */
export interface SerializableWorldSnapshot {
  maps: MapSnapshot[];
}

/**
 * Serializable map snapshot
 */
export interface MapSnapshot {
  name: string;
  width: number;
  height: number;
  config?: IMapConfig; // Store map config if needed
  renderedMap: string[]; // Each row as a string
}

/**
 * World snapshot serialization utilities for saving and loading world state efficiently
 */
export class WorldSnapshotSerializer {
  /**
   * Serialize a Choukai World to a compressed snapshot
   * @param world - The world to serialize
   * @param unitNames - Optional mapping from unit ID to unit name for rendering
   * @returns Serialized world snapshot data
   */
  static serialize(world: ChoukaiWorld): SerializableWorldSnapshot {
    console.log('WorldSnapshotSerializer.serialize called with', {
      mapsCount: world.getAllMaps().length,
    });

    const allMaps = world.getAllMaps();
    const serializedMaps: MapSnapshot[] = [];

    for (const map of allMaps) {
      console.log(
        `Processing map: ${map.name} with dimensions ${map.width}x${map.height}`
      );
      // Create a string representation of the map with only terrain symbols
      const renderedMap: string[] = [];

      for (let y = 0; y < map.height; y++) {
        let row = '';
        for (let x = 0; x < map.width; x++) {
          // Get cell terrain
          const cell = map.getCell(x, y);
          let cellContent = '';

          // Only render terrain, not units (units are managed separately by the unit controller)
          // This ensures the map snapshot shows the true underlying terrain state without units
          const terrain: TerrainType = cell ? cell.terrain : 'grass';
          // Use standard terrain symbols
          const terrainSymbols: Record<TerrainType, string> = {
            grass: '.',
            water: '~',
            mountain: '^',
            wall: '|',
            forest: 't',
            desert: '#',
            road: '=',
            plains: '.',
            swamp: ':',
            snow: '*',
            sand: '-',
          };
          const terrainSymbol = terrainSymbols[terrain] || '?';
          cellContent = terrainSymbol;

          row += cellContent;
        }
        renderedMap.push(row);
      }

      serializedMaps.push({
        name: map.name,
        width: map.width,
        height: map.height,
        config: map.config,
        renderedMap,
      });
    }

    console.log(
      `World serialized successfully. Maps: ${serializedMaps.length}`
    );
    return {
      maps: serializedMaps,
    };
  }

  /**
   * Deserialize a serialized world snapshot to a Choukai World
   * @param data - The serialized world snapshot data
   * @returns Deserialized world instance
   */
  static deserialize(data: SerializableWorldSnapshot): ChoukaiWorld {
    const world = new ChoukaiWorld();

    // Add all the maps to the world
    for (const mapSnapshot of data.maps) {
      // Create a new map
      const map = new ChoukaiMap(
        mapSnapshot.width,
        mapSnapshot.height,
        mapSnapshot.name,
        mapSnapshot.config
      );

      // Restore terrain from the rendered map
      for (
        let y = 0;
        y < map.height && y < mapSnapshot.renderedMap.length;
        y++
      ) {
        const row = mapSnapshot.renderedMap[y];
        if (row) {
          for (let x = 0; x < map.width && x < row.length; x++) {
            const char = row.charAt(x);

            // Identify terrain type based on character
            const terrainType = this.getTerrainTypeFromSymbol(char);
            if (terrainType) {
              map.setTerrain(x, y, terrainType);
            }
          }
        }
      }

      // Note: Units are handled separately by the world/unit systems
      // The rendered map preserves the visual representation of where units were located
      // but the actual unit restoration is managed by the unit controller independently

      world.addMap(map);
    }

    // The unit positions are already restored when we place units on the maps

    return world;
  }

  /**
   * Identify terrain type from symbol character
   * @param symbol - The character symbol
   * @returns The terrain type or null if unknown
   */
  private static getTerrainTypeFromSymbol(symbol: string): TerrainType | null {
    // Map symbols to terrain types based on standard mapping
    const terrainSymbols: Record<TerrainType, string> = {
      grass: '.',
      water: '~',
      mountain: '^',
      wall: '|',
      forest: 't',
      desert: '#',
      road: '=',
      plains: '.',
      swamp: ':',
      snow: '*',
      sand: '-',
    };

    // Find the terrain type that corresponds to this symbol
    for (const [terrainType, terrainSymbol] of Object.entries(terrainSymbols)) {
      if (terrainSymbol === symbol) {
        return terrainType as TerrainType;
      }
    }

    // If no match is found (for units which are represented by letters), return null
    return null;
  }

  /**
   * Compare two world snapshots to see if they're identical
   */
  static compareSnapshots(
    snapshot1: SerializableWorldSnapshot,
    snapshot2: SerializableWorldSnapshot
  ): boolean {
    if (snapshot1.maps.length !== snapshot2.maps.length) {
      return false;
    }

    return snapshot1.maps.every((map1, index) => {
      const map2 = snapshot2.maps[index];
      if (!map2) {
        return false;
      }
      if (
        map1.name !== map2.name ||
        map1.width !== map2.width ||
        map1.height !== map2.height ||
        map1.renderedMap.length !== map2.renderedMap.length
      ) {
        return false;
      }

      // Compare rendered maps
      return map1.renderedMap.every((row, j) => row === map2.renderedMap[j]);
    });
  }
}
