import type { BaseUnit, IUnitPosition } from '@atsu/atago';
import {
  World,
  Position,
  stepTowards,
  getPositionsAtCoordinate,
  findCollisions,
  getPositionAtCoordinate,
  getPositionsInMap,
  getPositionsWithinRange,
  getDistanceBetweenPositions,
  arePositionsAdjacent,
  getAdjacentPositions,
  isValidPosition,
  getAdjacentPositionsToPosition,
} from '@atsu/choukai';
import { isUnitPosition } from '../types/typeGuards';

/**
 * Helper function to convert units to position data structure
 * @param units Array of units to convert
 * @returns Array of position data objects
 */
interface UnitWithPosition {
  unit: BaseUnit;
  position: IUnitPosition;
}

function unitsToPositions(units: BaseUnit[]): Array<IUnitPosition> {
  return units
    .filter(unit => {
      const position = unit.getPropertyValue<IUnitPosition>('position');
      return position && isUnitPosition(position);
    })
    .map(
      unit => unit.getPropertyValue<IUnitPosition>('position') as IUnitPosition
    );
}

/**
 * Helper to map Choukai position results back to units
 * @param positions Array of position data objects
 * @param units Array of units to map from
 * @returns Array of units corresponding to the given positions
 */
function mapPositionsToUnits(
  positions: IUnitPosition[],
  units: BaseUnit[]
): BaseUnit[] {
  return positions
    .map(position => units.find(unit => unit.id === position.unitId))
    .filter((unit): unit is BaseUnit => Boolean(unit));
}

/**
 * Get a unit along with its position by unit ID
 * @param units
 * @param unitId
 * @returns
 */
function getUnitWithPosition(
  units: BaseUnit[],
  unitId: string
): UnitWithPosition | undefined {
  const unit = units.find(u => u.id === unitId);
  if (!unit) {
    return undefined;
  }

  const position = unit.getPropertyValue<IUnitPosition>('position');
  if (!position || !isUnitPosition(position)) {
    return undefined;
  }

  return { unit, position };
}

/**
 * Utility class that adapts unit-based operations to use Choukai's position functions
 */
export class UnitPosition {
  /**
   * Compute a single-tile step from one position toward another, clamped to map bounds.
   */
  static stepTowards(
    world: World,
    mapId: string,
    from: Position,
    to: Position
  ): Position {
    return stepTowards(world, mapId, from, to);
  }

  /**
   * Get all units at a specific map coordinate
   * @param units Array of units to search through
   * @param mapId The ID of the map to search
   * @param x X coordinate
   * @param y Y coordinate
   * @returns Array of units at the specified position
   */
  static getUnitsAtPosition(
    units: BaseUnit[],
    mapId: string,
    x: number,
    y: number
  ): BaseUnit[] {
    const positions = unitsToPositions(units);
    const positionResults = getPositionsAtCoordinate(positions, mapId, x, y);
    return mapPositionsToUnits(positionResults, units);
  }

  /**
   * Find any positions that have more than one unit on the same map coordinate
   * @param units Array of units to check for collisions
   * @returns Array of collision data, each containing mapId, x, y, and the units at that position
   */
  static findCollisions(
    units: BaseUnit[]
  ): Array<{ mapId: string; x: number; y: number; units: BaseUnit[] }> {
    const positions = unitsToPositions(units);
    const collisions = findCollisions(positions);

    return collisions.map(collision => ({
      mapId: collision.mapId,
      x: collision.x,
      y: collision.y,
      units: mapPositionsToUnits(collision.positions, units),
    }));
  }

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
    const positions = unitsToPositions(units);
    const positionResult = getPositionAtCoordinate(positions, mapId, x, y);
    if (!positionResult) {
      return undefined;
    }
    return mapPositionsToUnits([positionResult], units)[0];
  }

  /**
   * Get all units on a specific map
   * @param units Array of units to search through
   * @param mapId The ID of the map to search
   * @returns Array of units on the specified map
   */
  static getUnitsInMap(units: BaseUnit[], mapId: string): BaseUnit[] {
    const positions = unitsToPositions(units);
    const positionResults = getPositionsInMap(positions, mapId);
    return mapPositionsToUnits(positionResults, units);
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
    world: World,
    unitId: string,
    range: number,
    useManhattanDistance: boolean = true
  ): BaseUnit[] {
    const reference = getUnitWithPosition(units, unitId);
    if (!reference) {
      return [];
    }

    const positions = unitsToPositions(units);
    const positionResults = getPositionsWithinRange(
      positions,
      world,
      reference.position,
      range,
      useManhattanDistance
    );
    return mapPositionsToUnits(positionResults, units);
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

    return getDistanceBetweenPositions(pos1, pos2, useManhattanDistance);
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
    const left = getUnitWithPosition(units, unitId1);
    const right = getUnitWithPosition(units, unitId2);
    if (!left || !right) {
      return false;
    }
    return arePositionsAdjacent(left.position, right.position, allowDiagonal);
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
    return getAdjacentPositions(world, mapId, x, y, allowDiagonal);
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
    return isValidPosition(world, mapId, x, y);
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
    const reference = getUnitWithPosition(units, unitId);
    if (!reference) {
      return [];
    }

    const positions = unitsToPositions(units);
    const positionResults = getAdjacentPositionsToPosition(
      positions,
      world,
      reference.position,
      allowDiagonal
    );
    return mapPositionsToUnits(positionResults, units);
  }
}
