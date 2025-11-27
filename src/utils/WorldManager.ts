/**
 * World and map management utilities for Takao integration with Choukai
 * Provides essential utilities for world and map operations needed by the game engine
 */

import {
  Map as ChoukaiMap,
  World,
  Position,
  type IUnitPosition,
} from '@atsu/choukai';

/**
 * WorldManager class to handle world and map operations for the game
 */
export class WorldManager {
  /**
   * Creates a new map instance using Choukai
   * @param width - Width of the map
   * @param height - Height of the map
   * @param name - Name of the map
   * @returns New map instance
   */
  static createMap(width: number, height: number, name: string): ChoukaiMap {
    return new ChoukaiMap(width, height, name);
  }

  /**
   * Creates a new world instance using Choukai
   * @returns New world instance
   */
  static createWorld(): World {
    return new World();
  }

  /**
   * Generates a random valid position on the map
   * @param map - Map to generate position for
   * @returns Random position within map bounds
   */
  static getRandomPosition(map: ChoukaiMap): Position {
    const x = Math.floor(Math.random() * map.width);
    const y = Math.floor(Math.random() * map.height);
    return new Position(x, y);
  }

  /**
   * Sets a unit's position in the world
   * @param world - The world instance
   * @param unitId - ID of the unit
   * @param mapId - ID of the map
   * @param position - Position to set for the unit
   * @returns True if position was set successfully, false otherwise
   */
  static setUnitPosition(
    world: World,
    unitId: string,
    mapId: string,
    position: Position
  ): boolean {
    try {
      return world.setUnitPosition(unitId, mapId, position);
    } catch (error) {
      console.warn(
        `Failed to set position for unit ${unitId} on map ${mapId}: ${(error as Error).message}`
      );
      return false; // Operation failed due to missing resources
    }
  }

  /**
   * Gets a unit's position from the world
   * @param world - The world instance
   * @param unitId - ID of the unit
   * @returns IUnitPosition object containing unitId, mapId and position
   */
  static getUnitPosition(world: World, unitId: string): IUnitPosition {
    try {
      return world.getUnitPosition(unitId);
    } catch (error) {
      throw new Error(
        `Failed to get position for unit ${unitId}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Moves a unit within the world
   * @param world - The world instance
   * @param unitId - ID of the unit to move
   * @param newX - New X coordinate
   * @param newY - New Y coordinate
   * @returns True if movement was successful, false otherwise
   */
  static moveUnit(
    world: World,
    unitId: string,
    newX: number,
    newY: number
  ): boolean {
    try {
      return world.moveUnit(unitId, newX, newY);
    } catch (error) {
      console.warn(
        `Failed to move unit ${unitId} to position (${newX}, ${newY}): ${(error as Error).message}`
      );
      return false; // Operation failed due to missing resources
    }
  }
}
