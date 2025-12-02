import type { BaseUnit, IUnitPosition } from '@atsu/atago';
import { World, Position } from '@atsu/choukai';
import { isUnitPosition } from '../types/typeGuards';

/**
 * Utility class with pure functions for unit position operations
 */
export class UnitPosition {
  /**
   * Find the unit at a specific position on a map
   * @param units Array of units to search through
   * @param mapId The ID of the map to search
   * @param x X coordinate
   * @param y Y coordinate
   * @returns The unit at the specified position, or undefined if no unit is found
   */
  static getUnitAtPosition(
    units: BaseUnit[],
    mapId: string,
    x: number,
    y: number
  ): BaseUnit | undefined {
    return units.find(unit => {
      const position = unit.getPropertyValue<IUnitPosition>('position');
      if (!position || !isUnitPosition(position)) {
        return false;
      }
      return (
        position.mapId === mapId &&
        position.position.x === x &&
        position.position.y === y
      );
    });
  }

  /**
   * Get all units on a specific map
   * @param units Array of units to search through
   * @param mapId The ID of the map to search
   * @returns Array of units on the specified map
   */
  static getUnitsInMap(units: BaseUnit[], mapId: string): BaseUnit[] {
    return units.filter(unit => {
      const position = unit.getPropertyValue<IUnitPosition>('position');
      if (!position || !isUnitPosition(position)) {
        return false;
      }
      return position.mapId === mapId;
    });
  }

  /**
   * Get all units within a specific range of a given unit
   * @param units Array of units to search through
   * @param world The world containing the maps
   * @param unitId The ID of the reference unit
   * @param range The maximum distance range
   * @param useManhattanDistance Whether to use Manhattan distance (default: true)
   * @returns Array of units within the specified range
   */
  static getUnitsWithinRange(
    units: BaseUnit[],
    _world: World,
    unitId: string,
    range: number,
    useManhattanDistance: boolean = true
  ): BaseUnit[] {
    // Find the reference unit
    const referenceUnit = units.find(u => u.id === unitId);
    if (!referenceUnit) {
      return [];
    }

    // Get reference unit's position
    const refPosition =
      referenceUnit.getPropertyValue<IUnitPosition>('position');
    if (!refPosition || !isUnitPosition(refPosition)) {
      return [];
    }

    // Check if units are on the same map
    const sameMapUnits = units.filter(unit => {
      if (unit.id === unitId) return false; // Don't include the reference unit itself

      const position = unit.getPropertyValue<IUnitPosition>('position');
      if (!position || !isUnitPosition(position)) {
        return false;
      }
      return position.mapId === refPosition.mapId;
    });

    // Calculate distances and filter by range
    return sameMapUnits.filter(unit => {
      const position = unit.getPropertyValue<IUnitPosition>('position');
      if (!position || !isUnitPosition(position)) {
        return false;
      }

      // Calculate distance between positions by creating new Position objects
      const refPos = new Position(
        refPosition.position.x,
        refPosition.position.y,
        refPosition.position.z
      );
      const targetPos = new Position(
        position.position.x,
        position.position.y,
        position.position.z
      );

      const distance = useManhattanDistance
        ? refPos.manhattanDistanceTo(targetPos)
        : refPos.distanceTo(targetPos);

      return distance <= range;
    });
  }

  /**
   * Calculate the distance between two units
   * @param units Array of units to search through
   * @param unitId1 The ID of the first unit
   * @param unitId2 The ID of the second unit
   * @param useManhattanDistance Whether to use Manhattan distance (default: true)
   * @returns The distance between the two units, or Infinity if they are on different maps or one doesn't exist
   */
  static getDistanceBetweenUnits(
    units: BaseUnit[],
    unitId1: string,
    unitId2: string,
    useManhattanDistance: boolean = true
  ): number {
    const unit1 = units.find(u => u.id === unitId1);
    const unit2 = units.find(u => u.id === unitId2);

    if (!unit1 || !unit2) {
      return Infinity;
    }

    const pos1 = unit1.getPropertyValue<IUnitPosition>('position');
    const pos2 = unit2.getPropertyValue<IUnitPosition>('position');

    if (!pos1 || !pos2 || !isUnitPosition(pos1) || !isUnitPosition(pos2)) {
      return Infinity;
    }

    // If units are on different maps, return infinity
    if (pos1.mapId !== pos2.mapId) {
      return Infinity;
    }

    // Create Position instances for proper distance calculation
    const pos1Instance = new Position(
      pos1.position.x,
      pos1.position.y,
      pos1.position.z
    );
    const pos2Instance = new Position(
      pos2.position.x,
      pos2.position.y,
      pos2.position.z
    );

    return useManhattanDistance
      ? pos1Instance.manhattanDistanceTo(pos2Instance)
      : pos1Instance.distanceTo(pos2Instance);
  }

  /**
   * Check if two units are adjacent to each other
   * @param units Array of units to search through
   * @param world The world containing the maps
   * @param unitId1 The ID of the first unit
   * @param unitId2 The ID of the second unit
   * @param allowDiagonal Whether to consider diagonal positions as adjacent (default: true)
   * @returns True if the units are adjacent, false otherwise
   */
  static areUnitsAdjacent(
    units: BaseUnit[],
    _world: World,
    unitId1: string,
    unitId2: string,
    allowDiagonal: boolean = true
  ): boolean {
    const unit1 = units.find(u => u.id === unitId1);
    const unit2 = units.find(u => u.id === unitId2);

    if (!unit1 || !unit2) {
      return false;
    }

    const pos1 = unit1.getPropertyValue<IUnitPosition>('position');
    const pos2 = unit2.getPropertyValue<IUnitPosition>('position');

    if (!pos1 || !pos2 || !isUnitPosition(pos1) || !isUnitPosition(pos2)) {
      return false;
    }

    // If units are on different maps, they can't be adjacent
    if (pos1.mapId !== pos2.mapId) {
      return false;
    }

    // Calculate the absolute differences
    const dx = Math.abs(pos1.position.x - pos2.position.x);
    const dy = Math.abs(pos1.position.y - pos2.position.y);

    if (allowDiagonal) {
      // With diagonals allowed, units are adjacent if they're within Manhattan distance 1
      // This means either dx=1,dy=0 or dx=0,dy=1 or dx=1,dy=1 (diagonal)
      return (
        (dx === 1 && dy === 0) ||
        (dx === 0 && dy === 1) ||
        (dx === 1 && dy === 1)
      );
    } else {
      // Without diagonals, units are adjacent only if Manhattan distance is 1 and on same axis
      // This means either dx=1,dy=0 or dx=0,dy=1, but not dx=1,dy=1
      return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    }
  }

  /**
   * Get all adjacent positions to a given position on a map
   * @param world The world containing the maps
   * @param mapId The ID of the map
   * @param x The x coordinate
   * @param y The y coordinate
   * @param allowDiagonal Whether to include diagonal positions (default: true)
   * @returns Array of positions adjacent to the given position
   */
  static getAdjacentPositions(
    world: World,
    mapId: string,
    x: number,
    y: number,
    allowDiagonal: boolean = true
  ): Position[] {
    try {
      const map = world.getMap(mapId);

      // Define the directions - if allowDiagonal is false, only use cardinal directions
      const directions = allowDiagonal
        ? [
            { dx: -1, dy: 0 }, // left
            { dx: 1, dy: 0 }, // right
            { dx: 0, dy: -1 }, // up
            { dx: 0, dy: 1 }, // down
            { dx: -1, dy: -1 }, // up-left
            { dx: -1, dy: 1 }, // down-left
            { dx: 1, dy: -1 }, // up-right
            { dx: 1, dy: 1 }, // down-right
          ]
        : [
            { dx: -1, dy: 0 }, // left
            { dx: 1, dy: 0 }, // right
            { dx: 0, dy: -1 }, // up
            { dx: 0, dy: 1 }, // down
          ];

      const adjacentPositions: Position[] = [];

      for (const { dx, dy } of directions) {
        const newX = x + dx;
        const newY = y + dy;

        // Check if the position is within map bounds
        if (newX >= 0 && newX < map.width && newY >= 0 && newY < map.height) {
          adjacentPositions.push(new Position(newX, newY));
        }
      }

      return adjacentPositions;
    } catch {
      return []; // Return empty array if map doesn't exist
    }
  }

  /**
   * Check if a position is valid (within map bounds)
   * @param world The world containing the maps
   * @param mapId The ID of the map
   * @param x The x coordinate
   * @param y The y coordinate
   * @returns True if the position is valid, false otherwise
   */
  static isValidPosition(
    world: World,
    mapId: string,
    x: number,
    y: number
  ): boolean {
    try {
      const map = world.getMap(mapId);
      return x >= 0 && x < map.width && y >= 0 && y < map.height;
    } catch {
      return false; // Return false if map doesn't exist
    }
  }

  /**
   * Get all units adjacent to a specific unit
   * @param units Array of units to search through
   * @param world The world containing the maps
   * @param unitId The ID of the reference unit
   * @param allowDiagonal Whether to consider diagonal positions as adjacent (default: true)
   * @returns Array of adjacent units
   */
  static getAdjacentUnits(
    units: BaseUnit[],
    world: World,
    unitId: string,
    allowDiagonal: boolean = true
  ): BaseUnit[] {
    const referenceUnit = units.find(u => u.id === unitId);
    if (!referenceUnit) {
      return [];
    }

    const refPosition =
      referenceUnit.getPropertyValue<IUnitPosition>('position');
    if (!refPosition || !isUnitPosition(refPosition)) {
      return [];
    }

    // Get adjacent positions
    const adjacentPositions = UnitPosition.getAdjacentPositions(
      world,
      refPosition.mapId,
      refPosition.position.x,
      refPosition.position.y,
      allowDiagonal
    );

    // Find units at adjacent positions
    const adjacentUnits: BaseUnit[] = [];
    for (const adjPos of adjacentPositions) {
      const unitAtPos = UnitPosition.getUnitAtPosition(
        units,
        refPosition.mapId,
        adjPos.x,
        adjPos.y
      );
      if (unitAtPos && unitAtPos.id !== unitId) {
        adjacentUnits.push(unitAtPos);
      }
    }

    return adjacentUnits;
  }
}
