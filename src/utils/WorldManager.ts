/**
 * World and map management utilities for Takao integration with Choukai
 * Provides essential utilities for world and map operations needed by the game engine
 */

import { Map as ChoukaiMap, World, Position } from '@atsu/choukai';
import type { BaseUnit, IUnitPosition } from '@atsu/atago';
import { isUnitPosition } from '../types/typeGuards';

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
   * @param unit - The unit whose position is to be set
   * @param mapId - ID of the map
   * @param position - New position to set
   * @returns True if position was set successfully, false otherwise
   */
  static setUnitPosition(
    unit: BaseUnit,
    mapId: string,
    position: Position
  ): boolean {
    try {
      unit.setProperty('position', { unitId: unit.id, mapId, position });
      return true; // Position set successfully
    } catch (error) {
      console.warn(
        `Failed to set position for unit ${unit.id} on map ${mapId}: ${(error as Error).message}`
      );
      return false; // Operation failed due to missing resources
    }
  }

  /**
   * Gets a unit's position from the unit's property
   * @param unit - The unit whose position is to be retrieved
   * @returns IUnitPosition object containing unitId, mapId and position
   */
  static getUnitPosition(unit: BaseUnit): IUnitPosition {
    const positionData = unit.getPropertyValue<IUnitPosition>('position');
    if (isUnitPosition(positionData)) {
      return positionData;
    }
    throw new Error(
      `Failed to get position for unit ${unit.id}: Position data not found or invalid`
    );
  }

  /**
   * Moves a unit by updating the unit's position property
   * @param unit - The unit to move
   * @param newX - New X coordinate
   * @param newY - New Y coordinate
   * @returns True if movement was successful, false otherwise
   */
  static moveUnit(unit: BaseUnit, newX: number, newY: number): boolean {
    try {
      const positionData = unit.getPropertyValue<IUnitPosition>('position');
      if (!positionData) {
        throw new Error('Position data not found on unit');
      }

      // Create new position with updated coordinates, preserving mapId and z coordinate if exists
      const newUnitPosition: IUnitPosition = {
        unitId: unit.id,
        mapId: positionData.mapId,
        position: new Position(newX, newY, positionData.position.z),
      };

      unit.setProperty('position', newUnitPosition);
      return true;
    } catch (error) {
      console.warn(
        `Failed to move unit ${unit.id} to position (${newX}, ${newY}): ${(error as Error).message}`
      );
      return false; // Operation failed due to missing resources
    }
  }
}
