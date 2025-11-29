/**
 * Map serialization utilities for saving and loading maps
 */

import { Map as ChoukaiMap } from '@atsu/choukai';
import type { SerializableMap } from '../types';

/**
 * Map serialization utilities for saving and loading maps
 */
export class MapSerializer {
  /**
   * Serialize a Choukai Map to a plain object for JSON storage
   * @param map - The map to serialize
   * @returns Serialized map data
   */
  static serialize(map: ChoukaiMap): SerializableMap {
    return {
      width: map.width,
      height: map.height,
      name: map.name,
      config: map.config,
      cells: map.cells,
    };
  }

  /**
   * Deserialize a serialized map object to a Choukai Map
   * @param data - The serialized map data
   * @returns Deserialized map instance
   */
  static deserialize(data: SerializableMap): ChoukaiMap {
    // We need to create the map and then restore its state
    const map = new ChoukaiMap(data.width, data.height, data.name, data.config);

    // Overwrite the cells with the saved state
    map.cells = data.cells;

    return map;
  }

  /**
   * Bulk serialize multiple maps
   * @param maps - Array of maps to serialize
   * @returns Array of serialized map data
   */
  static serializeMany(maps: ChoukaiMap[]): SerializableMap[] {
    return maps.map(map => MapSerializer.serialize(map));
  }

  /**
   * Bulk deserialize multiple maps
   * @param data - Array of serialized map data
   * @returns Array of deserialized map instances
   */
  static deserializeMany(data: SerializableMap[]): ChoukaiMap[] {
    return data.map(mapData => MapSerializer.deserialize(mapData));
  }
}
