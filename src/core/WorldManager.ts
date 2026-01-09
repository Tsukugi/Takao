/**
 * WorldManager class to handle world and map operations for the game
 * Designed to be an instance class managed by GameEngine, providing
 * proper unit position management through the correct channels
 */

import type { BaseUnit, IUnitPosition } from '@atsu/atago';
import {
  World as ChoukaiWorld,
  Map as ChoukaiMap,
  Position,
  findNearestFreeTile,
  planMovementSteps,
  getMapPositionKey,
  type GateConnection as ChoukaiGateConnection,
  type IMapPosition,
} from '@atsu/choukai';
import { UnitController } from '../ai/UnitController';
import { MathUtils } from '../utils/Math';
import { GateSystem, type GateConnection } from '../utils/GateSystem';
import { Logger } from '../utils/Logger';
import { UnitPosition } from '../utils/UnitPosition';
import { isUnitPosition } from '../types/typeGuards';

export interface MovementStepUpdate {
  unitId: string;
  stepIndex: number;
  totalSteps: number;
  mapId: string;
  position: IMapPosition['position'];
}

export type MovementStepHandler = (
  update: MovementStepUpdate
) => void | Promise<void>;

export class WorldManager {
  private world: ChoukaiWorld;
  private unitController: UnitController;
  private gateSystem: GateSystem;
  private logger: Logger;

  constructor(
    world: ChoukaiWorld,
    unitController: UnitController,
    gateSystem: GateSystem,
    logger: Logger
  ) {
    this.world = world;
    this.unitController = unitController;
    this.gateSystem = gateSystem;
    this.logger = logger;
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

  /**
   * Replaces the world reference on this manager.
   */
  setWorld(world: ChoukaiWorld): void {
    this.world = world;
  }

  /**
   * Moves a unit to a specific position, handling collisions and gates.
   */
  async moveUnitToPosition(
    unitId: string,
    targetX: number,
    targetY: number
  ): Promise<boolean> {
    try {
      const units = this.unitController.getUnits();
      const unit = units.find(u => u.id === unitId);
      if (!unit) {
        throw new Error(
          `Unit ${this.formatUnitLabel(undefined, unitId)} not found`
        );
      }

      const unitLabel = this.formatUnitLabel(unit, unitId);
      const unitPos = unit.getPropertyValue<IUnitPosition>('position');
      if (!unitPos) {
        throw new Error(`Unit ${unitLabel} has no position property`);
      }

      if (this.gateSystem.hasGate(unitPos.mapId, targetX, targetY)) {
        await this.handleMapTransition(unitId, unitPos.mapId, targetX, targetY);
        return true;
      }

      const currentMap = this.world.getMap(unitPos.mapId);
      if (
        targetX < 0 ||
        targetX >= currentMap.width ||
        targetY < 0 ||
        targetY >= currentMap.height
      ) {
        this.logger.error(
          `Target position (${targetX}, ${targetY}) is out of bounds (${currentMap.width}x${currentMap.height})`
        );
        return false;
      }

      const newPosition = new Position(targetX, targetY, unitPos.position.z);
      const newUnitPosition: IUnitPosition = {
        unitId: unit.id,
        mapId: unitPos.mapId,
        position: newPosition,
      };
      unit.setProperty('position', newUnitPosition);

      const positions = this.unitController
        .getUnits()
        .map(u => u.getPropertyValue<IUnitPosition>('position'))
        .filter((pos): pos is IUnitPosition => Boolean(pos));
      const occupants = positions.filter(
        pos =>
          pos.mapId === unitPos.mapId &&
          pos.position.x === targetX &&
          pos.position.y === targetY
      );

      if (occupants.length > 1) {
        const free = findNearestFreeTile(
          this.world,
          unitPos.mapId,
          positions,
          newPosition
        );
        if (free) {
          const adjustedPosition: IUnitPosition = {
            unitId: unit.id,
            mapId: unitPos.mapId,
            position: new Position(free.x, free.y, unitPos.position.z),
          };
          unit.setProperty('position', adjustedPosition);
          this.logCollisionIfAny(unitPos.mapId, free.x, free.y);
        }
      } else {
        this.logCollisionIfAny(unitPos.mapId, targetX, targetY);
      }

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to move unit to position: ${err.message}`);
      return false;
    }
  }

  /**
   * Applies a planned movement path step-by-step for a unit.
   */
  async applyMovementPath(
    unitId: string,
    steps: IMapPosition[],
    onStep?: MovementStepHandler
  ): Promise<number> {
    if (steps.length === 0) {
      return 0;
    }

    const units = this.unitController.getUnits();
    const unit = units.find(u => u.id === unitId);
    if (!unit) {
      throw new Error(
        `Unit ${this.formatUnitLabel(undefined, unitId)} not found`
      );
    }

    const unitLabel = this.formatUnitLabel(unit);
    const totalSteps = steps.length;
    let stepsApplied = 0;

    for (let index = 0; index < totalSteps; index += 1) {
      const step = steps[index];
      if (!step) {
        continue;
      }

      const unitPos = unit.getPropertyValue<IUnitPosition>('position');
      if (!unitPos) {
        throw new Error(`Unit ${unitLabel} has no position property`);
      }

      if (step.mapId !== unitPos.mapId) {
        throw new Error(
          `Movement step map mismatch for ${unitLabel}: expected ${unitPos.mapId}, got ${step.mapId}`
        );
      }

      const moved = await this.moveUnitToPosition(
        unitId,
        step.position.x,
        step.position.y
      );
      if (!moved) {
        throw new Error(
          `Failed to move ${unitLabel} to (${step.position.x}, ${step.position.y})`
        );
      }

      stepsApplied += 1;

      if (onStep) {
        const updatedPos = unit.getPropertyValue<IUnitPosition>('position');
        if (!updatedPos) {
          throw new Error(`Unit ${unitLabel} missing position after movement`);
        }

        await onStep({
          unitId,
          stepIndex: index + 1,
          totalSteps,
          mapId: updatedPos.mapId,
          position: updatedPos.position,
        });
      }
    }

    return stepsApplied;
  }

  /**
   * Chooses a valid adjacent tile for exploration movement.
   */
  planRandomStep(unit: BaseUnit): { x: number; y: number; mapId: string } {
    const unitPos = unit.getPropertyValue<IUnitPosition>('position');
    if (!unitPos) {
      throw new Error(
        `Unit ${this.formatUnitLabel(unit)} is missing a position property.`
      );
    }

    const currentMap = this.world.getMap(unitPos.mapId);
    if (!currentMap) {
      throw new Error(
        `Map ${unitPos.mapId} not found while planning movement for unit ${this.formatUnitLabel(
          unit
        )}.`
      );
    }

    const directions = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];

    const dir = MathUtils.getRandomFromArray(directions);
    const maxX = currentMap.width - 1;
    const maxY = currentMap.height - 1;
    const newX = Math.max(0, Math.min(unitPos.position.x + dir.x, maxX));
    const newY = Math.max(0, Math.min(unitPos.position.y + dir.y, maxY));

    return { x: newX, y: newY, mapId: unitPos.mapId };
  }

  /**
   * Resolve a unit's movement range from its properties; missing means no movement.
   */
  getMovementRange(unit: BaseUnit): number {
    const value = unit.getPropertyValue<number>('movementRange');
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.floor(value));
  }

  /**
   * Plan an exploration path for a unit within its movement range.
   */
  planExploreMovement(unit: BaseUnit, units: BaseUnit[]): IMapPosition[] {
    const movementRange = this.getMovementRange(unit);
    if (movementRange === 0) {
      return [];
    }

    const unitPos = unit.getPropertyValue<IUnitPosition>('position');
    if (!unitPos) {
      throw new Error(
        `Unable to plan explore move for ${this.formatUnitLabel(
          unit
        )}: missing position data`
      );
    }

    const occupiedPositions = this.collectOccupiedPositions(units);
    const target = this.selectRandomTarget(
      unitPos,
      movementRange,
      occupiedPositions
    );

    if (!target) {
      this.logger.info(
        `No available exploration target for ${this.formatUnitLabel(unit)}`
      );
      return [];
    }

    const plan = planMovementSteps(
      this.world,
      { mapId: unitPos.mapId, position: unitPos.position },
      target,
      movementRange,
      {
        occupiedPositions,
        gateConnections: this.getGateConnections(),
        allowDiagonal: false,
        useManhattanDistance: true,
      }
    );

    return plan.steps;
  }

  /**
   * Plan a path toward a target unit, respecting movement range and action range.
   */
  planMovementTowardTarget(
    unit: BaseUnit,
    targetUnit: BaseUnit,
    units: BaseUnit[],
    actionRange: number
  ): { steps: IMapPosition[]; movedTowardsTarget: boolean } {
    const movementRange = this.getMovementRange(unit);
    if (movementRange === 0) {
      return { steps: [], movedTowardsTarget: false };
    }

    const unitPos = unit.getPropertyValue<IUnitPosition>('position');
    const targetPos = targetUnit.getPropertyValue<IUnitPosition>('position');
    if (!unitPos || !targetPos) {
      throw new Error(
        `Unable to plan move for ${this.formatUnitLabel(
          unit
        )} toward ${this.formatUnitLabel(targetUnit)}: missing position data`
      );
    }

    const distance = UnitPosition.getDistanceBetweenUnits(
      units,
      unit.id,
      targetUnit.id,
      true
    );
    if (distance <= actionRange) {
      this.logger.info(
        `Target already in range for ${this.formatUnitLabel(
          unit
        )} -> ${this.formatUnitLabel(targetUnit)}: distance ${distance} <= range ${actionRange}`
      );
      return { steps: [], movedTowardsTarget: false };
    }

    const plan = planMovementSteps(
      this.world,
      { mapId: unitPos.mapId, position: unitPos.position },
      { mapId: targetPos.mapId, position: targetPos.position },
      movementRange,
      {
        occupiedPositions: this.collectOccupiedPositions(units),
        gateConnections: this.getGateConnections(),
        allowDiagonal: false,
        stopWithinRange: actionRange,
        useManhattanDistance: true,
      }
    );

    const [firstStep] = plan.steps;
    if (firstStep) {
      this.logger.info(
        `Planned move for ${this.formatUnitLabel(
          unit
        )} -> ${this.formatUnitLabel(
          targetUnit
        )}: step to (${firstStep.position.x}, ${firstStep.position.y})`
      );
    }

    return { steps: plan.steps, movedTowardsTarget: plan.steps.length > 0 };
  }

  /**
   * Adds a gate connection between two maps.
   */
  addGate(gate: GateConnection): boolean {
    return this.gateSystem.addGate(gate);
  }

  /**
   * Removes a gate connection by name.
   */
  removeGate(gateName: string): boolean {
    return this.gateSystem.removeGate(gateName);
  }

  /**
   * Checks if there's a gate at a specific position on a map.
   */
  hasGate(mapId: string, x: number, y: number): boolean {
    return this.gateSystem.hasGate(mapId, x, y);
  }

  /**
   * Gets the destination gate connection for a position on a map.
   */
  getGateDestination(
    mapId: string,
    x: number,
    y: number
  ): GateConnection | undefined {
    return this.gateSystem.getDestination(mapId, x, y);
  }

  /**
   * Gets all gates for a specific map.
   */
  getGatesForMap(mapId: string): GateConnection[] {
    return this.gateSystem.getGatesForMap(mapId);
  }

  /**
   * Gets all gates in the system.
   */
  getAllGates(): GateConnection[] {
    return this.gateSystem.getAllGates();
  }

  private collectOccupiedPositions(units: BaseUnit[]): IMapPosition[] {
    return units
      .map(unit => unit.getPropertyValue<IUnitPosition>('position'))
      .filter(
        (pos): pos is IUnitPosition => Boolean(pos) && isUnitPosition(pos)
      )
      .map(pos => ({
        mapId: pos.mapId,
        position: pos.position,
      }));
  }

  private getGateConnections(): ChoukaiGateConnection[] {
    const gates = this.getAllGates();
    return gates.map(gate => ({
      mapFrom: gate.mapFrom,
      positionFrom: { x: gate.positionFrom.x, y: gate.positionFrom.y },
      mapTo: gate.mapTo,
      positionTo: { x: gate.positionTo.x, y: gate.positionTo.y },
      ...(gate.name ? { name: gate.name } : {}),
      ...(gate.bidirectional !== undefined
        ? { bidirectional: gate.bidirectional }
        : {}),
    }));
  }

  private selectRandomTarget(
    unitPos: IUnitPosition,
    movementRange: number,
    occupied: IMapPosition[]
  ): IMapPosition | null {
    const map = this.world.getMap(unitPos.mapId);
    const blocked = new Set(occupied.map(pos => getMapPositionKey(pos)));

    const candidates: IMapPosition[] = [];

    for (let dy = -movementRange; dy <= movementRange; dy++) {
      for (let dx = -movementRange; dx <= movementRange; dx++) {
        const distance = Math.abs(dx) + Math.abs(dy);
        if (distance > movementRange) {
          continue;
        }

        const x = unitPos.position.x + dx;
        const y = unitPos.position.y + dy;
        if (x === unitPos.position.x && y === unitPos.position.y) {
          continue;
        }

        if (!map.isWalkable(x, y)) {
          continue;
        }

        const key = getMapPositionKey({
          mapId: unitPos.mapId,
          position: { x, y },
        });
        if (blocked.has(key)) {
          continue;
        }

        candidates.push({
          mapId: unitPos.mapId,
          position: new Position(x, y),
        });
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    return MathUtils.getRandomFromArray(candidates);
  }

  private async handleMapTransition(
    unitId: string,
    currentMapId: string,
    x: number,
    y: number
  ): Promise<void> {
    if (!this.gateSystem.hasGate(currentMapId, x, y)) {
      return;
    }

    const gate = this.gateSystem.getDestination(currentMapId, x, y);
    if (!gate) {
      return;
    }

    let unitLabel = this.formatUnitLabel(undefined, unitId);
    try {
      const units = this.unitController.getUnits();
      const unit = units.find(u => u.id === unitId);
      if (!unit) {
        this.logger.error(`Unit ${unitLabel} not found for gate transition`);
        return;
      }

      unitLabel = this.formatUnitLabel(unit, unitId);
      const positionToUse =
        gate.positionTo instanceof Position
          ? gate.positionTo
          : new Position(gate.positionTo.x, gate.positionTo.y);

      const newUnitPosition: IUnitPosition = {
        unitId: unit.id,
        mapId: gate.mapTo,
        position: positionToUse,
      };
      unit.setProperty('position', newUnitPosition);
      this.logCollisionIfAny(gate.mapTo, gate.positionTo.x, gate.positionTo.y);

      this.logger.info(
        `Unit ${unitLabel} moved through gate from ${currentMapId}(${x},${y}) to ${gate.mapTo}(${gate.positionTo.x},${gate.positionTo.y})`
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Error during gate transition for unit ${unitLabel}: ${err.message}`
      );
    }
  }

  private logCollisionIfAny(mapId: string, x: number, y: number): void {
    const units = this.unitController.getUnits();
    const occupants = UnitPosition.getUnitsAtPosition(units, mapId, x, y);
    if (occupants.length <= 1) {
      return;
    }

    const occupantLabels = occupants.map(u => `${u.name || 'Unit'} (${u.id})`);
    this.logger.warn(
      `Collision detected on ${mapId} at (${x},${y}): ${occupantLabels.join(', ')}`
    );
  }

  private formatUnitLabel(unit?: BaseUnit | null, fallbackId?: string): string {
    const unitId = unit?.id ?? fallbackId;
    if (unit?.name) {
      return unitId ? `${unit.name} (${unitId})` : unit.name;
    }
    if (unitId) {
      return unitId;
    }
    return 'unknown unit';
  }
}
