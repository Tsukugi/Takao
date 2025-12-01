/**
 * WorldManager class to handle world and map operations for the game
 * Designed to be an instance class managed by GameEngine, providing
 * proper unit position management through the correct channels
 */

import {
  World as ChoukaiWorld,
  Map as ChoukaiMap,
  Position,
} from '@atsu/choukai';

export class WorldManager {
  private world: ChoukaiWorld;

  constructor(world: ChoukaiWorld) {
    this.world = world;
  }

  /**
   * Creates a new map instance using Choukai
   * @param width - Width of the map
   * @param height - Height of the map
   * @param name - Name of the map
   * @returns New map instance
   */
  createMap(width: number, height: number, name: string): ChoukaiMap {
    return new ChoukaiMap(width, height, name);
  }

  /**
   * Creates a new world instance using Choukai
   * @returns New world instance
   */
  createWorld(): ChoukaiWorld {
    return new ChoukaiWorld();
  }

  /**
   * Generates a random valid position on the map
   * @param map - Map to generate position for
   * @returns Random position within map bounds
   */
  getRandomPosition(map: ChoukaiMap): Position {
    const x = Math.floor(Math.random() * map.width);
    const y = Math.floor(Math.random() * map.height);
    return new Position(x, y);
  }

  /**
   * Gets the world instance this manager operates on
   */
  getWorld(): ChoukaiWorld {
    return this.world;
  }
}
