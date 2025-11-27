/**
 * World serialization utilities for saving and loading world state
 */

import { World as ChoukaiWorld } from '@atsu/choukai';
import type { IUnitPosition } from '@atsu/choukai';
import { MapSerializer, type SerializableMap } from './MapSerializer';

/**
 * Serializable world data structure
 */
export interface SerializableWorld {
  maps: SerializableMap[];
  unitPositions: IUnitPosition[];
}

/**
 * World serialization utilities for saving and loading world state
 */
export class WorldSerializer {
  /**
   * Serialize a Choukai World to a plain object for JSON storage
   * @param world - The world to serialize
   * @returns Serialized world data
   */
  static serialize(world: ChoukaiWorld): SerializableWorld {
    // Get all maps and serialize them
    const allMaps = world.getAllMaps();
    const serializedMaps = allMaps.map(map => MapSerializer.serialize(map));

    // Get all units in the world
    const allUnits = world.getAllUnits();

    return {
      maps: serializedMaps,
      unitPositions: allUnits,
    };
  }

  /**
   * Deserialize a serialized world object to a Choukai World
   * @param data - The serialized world data
   * @returns Deserialized world instance
   */
  static deserialize(data: SerializableWorld): ChoukaiWorld {
    const world = new ChoukaiWorld();

    // Add all the maps to the world
    for (const serializedMap of data.maps) {
      const map = MapSerializer.deserialize(serializedMap);
      world.addMap(map);
    }

    // Restore unit positions - since we only save the positions, we need a way to restore them
    // For now, we'll just return the world with maps; unit positioning might be handled separately
    // depending on the game engine's requirements

    return world;
  }
}
