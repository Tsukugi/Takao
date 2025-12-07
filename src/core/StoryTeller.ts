/**
 * Extended StoryTeller that can manage maps in addition to narrative generation
 * Uses MapGenerator to create and manage game world maps that players can move between
 */

import { UnitController } from '../ai/UnitController';
import type { Action, ExecutedAction, ActionsData, DiaryEntry } from '../types';
import { DataManager } from '../utils/DataManager';
import { ConfigManager } from '../utils/ConfigManager';
import { StatTracker } from '../utils/StatTracker';
import { ActionProcessor } from '../utils/ActionProcessor';
import { MathUtils } from '../utils/Math';
import { ConditionParser } from '../utils/ConditionParser';
import { BaseUnit, type IUnitPosition } from '@atsu/atago';
import { isComparison } from '../types/typeGuards';
import { MapGenerator } from '../utils/MapGenerator';
import { World, Map as ChoukaiMap, Position } from '@atsu/choukai';
import { GateSystem, type GateConnection } from '../utils/GateSystem';
import { Logger } from '../utils/Logger';
import { UnitPosition } from '../utils/UnitPosition';
import { GoalSystem } from '../ai/goals/GoalSystem';

/**
 * Represents the StoryTeller that generates narrative actions based on unit states
 * and can also manage world maps and unit movement between maps
 */
export class StoryTeller {
  private unitController: UnitController;
  private actionsData: ActionsData;
  private goalSystem: GoalSystem;
  private storyHistory: string[] = [];
  private diary: DiaryEntry[] = [];
  private mapGenerator: MapGenerator;
  private world: World;
  private gateSystem: GateSystem;
  private logger: Logger;
  private actionProcessor: ActionProcessor;

  constructor(unitController: UnitController, world?: World) {
    const isVisualOnlyMode = ConfigManager.getConfig().rendering.visualOnly;
    this.logger = new Logger({
      prefix: 'StoryTeller',
      disable: isVisualOnlyMode,
    });
    this.unitController = unitController;
    this.actionsData = DataManager.loadActions();
    this.goalSystem = new GoalSystem();
    this.diary = DataManager.loadDiary(); // Load existing diary entries
    DataManager.ensureDataDirectory(); // Ensure data directory exists
    this.actionProcessor = new ActionProcessor(this.logger); // Initialize action processor with logger

    // Initialize map generation capabilities
    this.mapGenerator = new MapGenerator();

    // Use provided world or create our own
    if (world) {
      this.world = world;
      this.logger.info(
        `using provided world with ${world.getAllMaps().length} maps`
      );
    } else {
      // Load existing world from file if available, otherwise create a new one
      const loadedWorld = DataManager.loadWorld();
      if (loadedWorld) {
        this.logger.info(
          `loaded world with ${loadedWorld.getAllMaps().length} maps from saved state`
        );
        this.world = loadedWorld;
      } else {
        this.logger.info('creating new world');
        this.world = new World();
      }
    }

    this.gateSystem = new GateSystem();

    // Ensure the action processor knows about the current world for range validation
    this.actionProcessor.setWorld(this.world);
  }

  /**
   * Generates a story action based on the current unit states
   */
  public async generateStoryAction(turn: number): Promise<ExecutedAction> {
    // Get the current state of units from the UnitController
    const units = await this.unitController.getUnitState();

    // Generate a story action based on unit states
    const storyAction = await this.createStoryBasedOnUnits(units, turn);

    // Take a snapshot of unit properties before action execution
    const initialStates = StatTracker.takeSnapshot(units);

    // Execute action effects using the ActionProcessor
    const result = await this.actionProcessor.executeActionEffect(
      storyAction.action,
      units
    );
    if (!result.success) {
      this.logger.error(
        `Failed to execute action effect: ${result.errorMessage || 'Unknown error'}`
      );
      return storyAction; // Return early if execution fails
    }

    // Handle new units if any were created
    if (storyAction.action.type === 'unit_join') {
      const newUnit = await this.unitController.addNewUnit();

      // Add the new unit to the world
      if (newUnit) {
        // Place the new unit at a default position (we could make this more sophisticated)
        const mainMap = this.world.getAllMaps()[0];
        if (mainMap) {
          const x = Math.floor(Math.random() * mainMap.width);
          const y = Math.floor(Math.random() * mainMap.height);

          newUnit.setProperty('position', {
            unitId: newUnit.id,
            mapId: mainMap.name,
            position: new Position(x, y),
          });
        }
      }
    }

    // Get stat changes by comparing snapshots
    const changes = StatTracker.compareSnapshots(initialStates, units);

    if (changes.length > 0) {
      // Group changes by unit and format them
      const groupedChanges = StatTracker.groupChangesByUnit(changes);

      this.logger.info(
        `Stat changes for action: ${storyAction.action.type} by ${storyAction.action.player}`
      );

      for (const [unitId, unitChanges] of groupedChanges) {
        const unit = units.find(u => u.id === unitId);
        if (unit) {
          const formattedChanges = StatTracker.formatStatChanges(unitChanges);
          this.logger.info(
            `  ${unit.name} (${unit.id}): ${formattedChanges.join(', ')}`
          );
        }
      }
    }

    // Add to story history
    this.storyHistory.push(
      `Turn ${turn}: ${this.describeAction(storyAction.action)}`
    );

    // Save the current unit states and diary entry
    this.saveUnits();
    this.saveDiaryEntry(storyAction, turn);

    return storyAction;
  }

  /**
   * Creates a story action based on unit states
   */
  private async createStoryBasedOnUnits(
    units: BaseUnit[],
    turn: number
  ): Promise<ExecutedAction> {
    // If no units exist, create a default action
    if (units.length === 0) {
      // Return a default narrative action instead of throwing
      return this.actionProcessor.getDefaultExecutedAction(
        new BaseUnit('default-unit', 'DefaultUnit', 'unknown', {}),
        turn
      );
    }

    // Filter out dead units - only consider alive units for taking actions
    const aliveUnits = units.filter(unit => {
      const statusProperty = unit.properties?.status;
      return !statusProperty || statusProperty.value !== 'dead';
    });

    // Filter units by cooldown - units can only act once every few turns
    const cooldownPeriod = ConfigManager.getConfig().cooldownPeriod || 1; // Default to 1 (every turn)
    const now = turn;
    const availableUnits = aliveUnits.filter(unit => {
      const lastTurnProperty = unit.getPropertyValue('lastActionTurn');
      const lastTurn = lastTurnProperty ? lastTurnProperty.value : -Infinity;
      return now - lastTurn >= cooldownPeriod;
    });

    // If no units are available due to cooldown, use all alive units (reset cooldowns)
    const unitsToConsider =
      availableUnits.length > 0 ? availableUnits : aliveUnits;

    // If no alive units exist, return a default action
    if (aliveUnits.length === 0) {
      return this.actionProcessor.getDefaultExecutedAction(
        new BaseUnit('default-unit', 'DefaultUnit', 'unknown', {}),
        turn
      );
    }

    // Choose a random alive unit to center the story around
    const randomUnit = MathUtils.getRandomFromArray(unitsToConsider);

    // Get properties of the unit to create a meaningful story
    const unitName = randomUnit.name;
    const unitType = randomUnit.type;

    // Create a story action based on unit properties using JSON data
    let description = '';

    const availableActions = this.getAvailableActionsForUnit(randomUnit);

    const goalChoice = this.goalSystem.chooseAction(randomUnit, {
      availableActions,
      units,
      turn,
    });

    const selectedAction =
      goalChoice.action ?? MathUtils.getRandomFromArray(availableActions);

    if (!selectedAction) {
      return this.actionProcessor.getDefaultExecutedAction(randomUnit, turn);
    }

    if (selectedAction.type === 'explore') {
      this.moveUnitRandomStep(randomUnit);
    }

    // For interaction-type actions, select another unit to interact with
    let targetUnit = null;
    let targetUnitName = 'another unit';
    const actionPayload = { ...(selectedAction.payload || {}) };

    if (
      ['interact', 'attack', 'support', 'trade'].includes(
        selectedAction.type
      ) &&
      units.length > 1
    ) {
      // Find a different unit to interact with
      const otherUnits = units.filter(u => u.id !== randomUnit.id);
      if (otherUnits.length > 0) {
        targetUnit = MathUtils.getRandomFromArray(otherUnits);
        targetUnitName = targetUnit.name;
        actionPayload.targetUnit = targetUnit.id;
      }
    }

    // If we have a target and are out of range, step toward the target before the action
    if (targetUnit) {
      const actionRange = this.getActionRange(selectedAction);
      const distance = UnitPosition.getDistanceBetweenUnits(
        units,
        randomUnit.id,
        targetUnit.id,
        true
      );

      if (distance === Infinity) {
        this.logger.warn(
          `Units ${randomUnit.id} and ${targetUnit.id} are on different maps; cannot move toward target`
        );
      } else if (distance > actionRange) {
        const unitPos = randomUnit.getPropertyValue<IUnitPosition>('position');
        const targetPos =
          targetUnit.getPropertyValue<IUnitPosition>('position');
        if (unitPos && targetPos && unitPos.mapId === targetPos.mapId) {
          const nextStep = UnitPosition.stepTowards(
            this.world,
            unitPos.mapId,
            new Position(
              unitPos.position.x,
              unitPos.position.y,
              unitPos.position.z
            ),
            new Position(
              targetPos.position.x,
              targetPos.position.y,
              targetPos.position.z
            )
          );

          // Move the unit one tile closer; ignore result, since attack may still be out of range
          await this.moveUnitToPosition(randomUnit.id, nextStep.x, nextStep.y);
          actionPayload.movedTowardsTarget = true;
          actionPayload.movedTo = { x: nextStep.x, y: nextStep.y };
        }
      }
    }

    // Create description by replacing placeholders
    description = selectedAction.description
      .replace('{{unitName}}', unitName)
      .replace('{{unitType}}', unitType)
      .replace('{{targetUnitName}}', targetUnitName);

    if (actionPayload.movedTowardsTarget) {
      const movedTo = actionPayload.movedTo as
        | { x: number; y: number }
        | undefined;
      const movedText = movedTo
        ? `Moves closer to ${targetUnitName} (${movedTo.x},${movedTo.y}) to get in range. `
        : `Moves closer to ${targetUnitName} to get in range. `;
      description = `${movedText}${description}`;
    }

    // Create action payload based on action type

    // Record that this unit took an action in this turn
    randomUnit.setProperty('lastActionTurn', {
      name: 'lastActionTurn',
      value: turn,
      baseValue: turn,
    });

    return {
      turn,
      timestamp: Date.now(),
      action: {
        ...selectedAction,
        description,
        player: unitName, // Add the unit's name as the player
        payload: actionPayload, // Ensure payload exists and includes target when needed
      },
    };
  }

  private getActionRange(action: Action): number {
    if (action?.payload && typeof action.payload.range === 'number') {
      return action.payload.range;
    }
    return 1;
  }

  private getAvailableActionsForUnit(unit: BaseUnit): Action[] {
    const availableActions: Action[] = [];
    const overrideActionList =
      ConfigManager.getConfig().overrideAvailableActions;

    for (const action of this.actionsData) {
      if (
        overrideActionList &&
        overrideActionList.length > 0 &&
        !overrideActionList.includes(action.type)
      ) {
        continue;
      }

      if (action.requirements) {
        let meetsAllRequirements = true;
        for (const requirement of action.requirements) {
          if (isComparison(requirement)) {
            const unitValue = unit.getPropertyValue(requirement.property);
            const conditionString = `${requirement.property} ${requirement.operator} ${requirement.value}`;
            if (
              !ConditionParser.evaluateCondition(conditionString, unitValue)
            ) {
              meetsAllRequirements = false;
              break;
            }
          }
        }
        if (!meetsAllRequirements) {
          continue;
        }
      }

      availableActions.push(action);
    }

    if (availableActions.length === 0) {
      return [...this.actionsData];
    }

    return availableActions;
  }

  /**
   * Moves a unit to a specific position on the current map
   */
  public async moveUnitToPosition(
    unitId: string,
    targetX: number,
    targetY: number
  ): Promise<boolean> {
    try {
      // Get the actual unit from the unit controller
      const units = this.unitController.getUnits();
      const unit = units.find(u => u.id === unitId);
      if (!unit) {
        throw new Error(`Unit ${unitId} not found`);
      }

      const unitPos = unit.getPropertyValue<IUnitPosition>('position');
      if (!unitPos) {
        throw new Error(`Unit ${unitId} has no position property`);
      }

      // Check if there's a gate at the target position - if so, perform gate transition instead of regular move
      if (this.gateSystem.hasGate(unitPos.mapId, targetX, targetY)) {
        // Perform gate transition
        await this.handleMapTransition(unitId, unitPos.mapId, targetX, targetY);
        return true; // Transition was attempted
      }

      // Validate the target position is within map bounds
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

      // Update the position using the unit's property directly
      const newPosition = new Position(targetX, targetY, unitPos.position.z);
      const newUnitPosition: IUnitPosition = {
        unitId: unit.id,
        mapId: unitPos.mapId,
        position: newPosition,
      };
      unit.setProperty('position', newUnitPosition);
      this.logCollisionIfAny(unitPos.mapId, targetX, targetY);
      const moved = true; // Movement always succeeds when setting the property directly

      return moved;
    } catch (error) {
      this.logger.error(
        `Failed to move unit to position: ${(error as Error).message}`
      );
      return false;
    }
  }

  private moveUnitRandomStep(unit: BaseUnit): boolean {
    const unitPos = unit.getPropertyValue<IUnitPosition>('position');
    if (!unitPos) {
      return false;
    }

    const currentMap = this.world.getMap(unitPos.mapId);
    if (!currentMap) {
      return false;
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

    const newPosition = new Position(newX, newY, unitPos.position.z);
    const newUnitPosition: IUnitPosition = {
      unitId: unit.id,
      mapId: unitPos.mapId,
      position: newPosition,
    };
    unit.setProperty('position', newUnitPosition);
    this.logCollisionIfAny(unitPos.mapId, newX, newY);
    return true;
  }

  /**
   * Handles map transitions when a unit reaches a gate
   */
  private async handleMapTransition(
    unitId: string,
    currentMapId: string,
    x: number,
    y: number
  ): Promise<void> {
    // Check if there's a gate at the current position
    if (this.gateSystem.hasGate(currentMapId, x, y)) {
      const gate = this.gateSystem.getDestination(currentMapId, x, y);

      if (gate) {
        // Attempt to move the unit through the gate to the destination map
        try {
          // Get the actual unit from the unit controller
          const units = this.unitController.getUnits();
          const unit = units.find(u => u.id === unitId);
          if (!unit) {
            this.logger.error(`Unit ${unitId} not found for gate transition`);
            return;
          }

          // Update the unit's position using the unit's property directly
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
          this.logCollisionIfAny(
            gate.mapTo,
            gate.positionTo.x,
            gate.positionTo.y
          );

          this.logger.info(
            `Unit ${unitId} moved through gate from ${currentMapId}(${x},${y}) to ${gate.mapTo}(${gate.positionTo.x},${gate.positionTo.y})`
          );
        } catch (error) {
          this.logger.error(
            `Error during gate transition for unit ${unitId}: ${(error as Error).message}`
          );
        }
      }
    }
  }

  /**
   * Creates a map using the MapGenerator
   */
  public createMap(name: string, width?: number, height?: number): ChoukaiMap {
    return this.mapGenerator.generateMap(name, width, height);
  }

  /**
   * Creates a world with interconnected maps
   */
  public createWorldWithMaps(mapNames: string[]): World {
    return this.mapGenerator.generateWorldWithMaps(mapNames);
  }

  /**
   * Gets the current world instance
   */
  public getWorld(): World {
    return this.world;
  }

  /**
   * Adds a gate connection between two maps
   */
  public addGate(gate: GateConnection): boolean {
    return this.gateSystem.addGate(gate);
  }

  /**
   * Removes a gate connection by name
   */
  public removeGate(gateName: string): boolean {
    return this.gateSystem.removeGate(gateName);
  }

  /**
   * Checks if there's a gate at a specific position on a map
   */
  public hasGate(mapId: string, x: number, y: number): boolean {
    return this.gateSystem.hasGate(mapId, x, y);
  }

  /**
   * Gets the destination gate connection for a position on a map
   */
  public getGateDestination(
    mapId: string,
    x: number,
    y: number
  ): GateConnection | undefined {
    return this.gateSystem.getDestination(mapId, x, y);
  }

  /**
   * Logs if multiple units occupy the same tile. Does not block movement.
   */
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

  /**
   * Gets all gates for a specific map
   */
  public getGatesForMap(mapId: string): GateConnection[] {
    return this.gateSystem.getGatesForMap(mapId);
  }

  /**
   * Gets all gates in the system
   */
  public getAllGates(): GateConnection[] {
    return this.gateSystem.getAllGates();
  }

  /**
   * Gets the unit at a specific position on a map
   */
  public getUnitAtPosition(
    mapId: string,
    x: number,
    y: number
  ): BaseUnit | undefined {
    const units = this.unitController.getUnits();
    return UnitPosition.getUnitAtPosition(units, mapId, x, y);
  }

  /**
   * Gets all units on a specific map
   */
  public getUnitsInMap(mapId: string): BaseUnit[] {
    const units = this.unitController.getUnits();
    return UnitPosition.getUnitsInMap(units, mapId);
  }

  /**
   * Gets all units within a specific range of a given unit
   */
  public getUnitsWithinRange(
    unitId: string,
    range: number,
    useManhattanDistance: boolean = true
  ): BaseUnit[] {
    const units = this.unitController.getUnits();
    return UnitPosition.getUnitsWithinRange(
      units,
      this.world,
      unitId,
      range,
      useManhattanDistance
    );
  }

  /**
   * Calculates the distance between two units
   */
  public getDistanceBetweenUnits(
    unitId1: string,
    unitId2: string,
    useManhattanDistance: boolean = true
  ): number {
    const units = this.unitController.getUnits();
    return UnitPosition.getDistanceBetweenUnits(
      units,
      unitId1,
      unitId2,
      useManhattanDistance
    );
  }

  /**
   * Checks if two units are adjacent to each other
   */
  public areUnitsAdjacent(
    unitId1: string,
    unitId2: string,
    allowDiagonal: boolean = true
  ): boolean {
    const units = this.unitController.getUnits();
    return UnitPosition.areUnitsAdjacent(
      units,
      this.world,
      unitId1,
      unitId2,
      allowDiagonal
    );
  }

  /**
   * Gets all adjacent units to a specific unit
   */
  public getAdjacentUnits(
    unitId: string,
    allowDiagonal: boolean = true
  ): BaseUnit[] {
    const units = this.unitController.getUnits();
    return UnitPosition.getAdjacentUnits(
      units,
      this.world,
      unitId,
      allowDiagonal
    );
  }

  /**
   * Saves the current unit states to JSON
   */
  public saveUnits(): void {
    const units = this.unitController.getUnits();
    DataManager.saveUnits(units);
  }

  /**
   * Saves the current world state to JSON
   */
  public saveWorld(): void {
    DataManager.saveWorld(this.world);
  }

  /**
   * Saves a diary entry about the current turn
   */
  public saveDiaryEntry(executedAction: ExecutedAction, turn: number): void {
    const diaryEntry: DiaryEntry = {
      turn,
      timestamp: new Date().toISOString(),
      action: executedAction.action,
    };

    DataManager.saveDiaryEntry(diaryEntry);
    this.diary.push(diaryEntry);
  }

  /**
   * Gets the diary entries
   */
  public getDiary(): DiaryEntry[] {
    return [...this.diary];
  }

  /**
   * Creates a description of the action
   */
  private describeAction(action: Action): string {
    return (
      action.description ||
      `${action.type} action by ${action.player || 'unknown'}`
    );
  }

  /**
   * Gets the story history
   */
  public getStoryHistory(): string[] {
    return [...this.storyHistory];
  }

  /**
   * Gets the latest story entry
   */
  public getLatestStory(): string | undefined {
    if (this.storyHistory.length === 0) {
      return undefined;
    }
    const lastStory = this.storyHistory[this.storyHistory.length - 1];
    return typeof lastStory === 'string' ? lastStory : undefined;
  }
}
