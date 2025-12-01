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
import { BaseUnit } from '@atsu/atago';
import { isComparison } from '../types/typeGuards';
import { MapGenerator } from '../utils/MapGenerator';
import { World, Map as ChoukaiMap, Position } from '@atsu/choukai';
import { WorldManager } from '../utils/WorldManager';
import { GateSystem, type GateConnection } from '../utils/GateSystem';
import { Logger } from '../utils/Logger';

/**
 * Represents the StoryTeller that generates narrative actions based on unit states
 * and can also manage world maps and unit movement between maps
 */
export class StoryTeller {
  private unitController: UnitController;
  private actionsData: ActionsData;
  private storyHistory: string[] = [];
  private diary: DiaryEntry[] = [];
  private mapGenerator: MapGenerator;
  private world: World;
  private gateSystem: GateSystem;
  private logger: Logger;
  private actionProcessor: ActionProcessor;

  constructor(unitController: UnitController) {
    const isVisualOnlyMode = ConfigManager.getConfig().rendering.visualOnly;
    this.logger = new Logger({
      prefix: 'StoryTeller',
      disable: isVisualOnlyMode,
    });
    this.unitController = unitController;
    this.actionsData = DataManager.loadActions();
    this.diary = DataManager.loadDiary(); // Load existing diary entries
    DataManager.ensureDataDirectory(); // Ensure data directory exists
    this.actionProcessor = new ActionProcessor(this.logger); // Initialize action processor with logger

    // Initialize map generation capabilities
    this.mapGenerator = new MapGenerator();

    // Load existing world from file if available, otherwise create a new one
    const loadedWorld = DataManager.loadWorld();
    if (loadedWorld) {
      this.logger.info(
        `loaded world with ${loadedWorld.getAllMaps().length} maps from saved state`
      );
      this.world = loadedWorld;
    } else {
      this.logger.info('creating new world');
      this.world = WorldManager.createWorld();
    }

    this.gateSystem = new GateSystem();
  }

  /**
   * Generates a story action based on the current unit states
   */
  public async generateStoryAction(turn: number): Promise<ExecutedAction> {
    // Get the current state of units from the UnitController
    const units = await this.unitController.getUnitState();

    // Generate a story action based on unit states
    const storyAction = this.createStoryBasedOnUnits(units, turn);

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

          WorldManager.setUnitPosition(
            newUnit,
            mainMap.name,
            new Position(x, y)
          );
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
  private createStoryBasedOnUnits(
    units: BaseUnit[],
    turn: number
  ): ExecutedAction {
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

    // If no alive units exist, return a default action
    if (aliveUnits.length === 0) {
      return this.actionProcessor.getDefaultExecutedAction(
        new BaseUnit('default-unit', 'DefaultUnit', 'unknown', {}),
        turn
      );
    }

    // Choose a random alive unit to center the story around
    const randomUnit = MathUtils.getRandomFromArray(aliveUnits);

    // Get properties of the unit to create a meaningful story
    const unitName = randomUnit.name;
    const unitType = randomUnit.type;

    // Create a story action based on unit properties using JSON data
    let description = '';

    // Get available actions based on unit requirements and config settings
    let availableActions: Action[] = [];

    // Get override actions from config
    const overrideActionList =
      ConfigManager.getConfig().overrideAvailableActions;

    // Filter actions based on unit requirements (health, mana, etc.) and config
    for (const action of this.actionsData) {
      // If overrideAvailableActions is specified, only use those actions
      if (
        overrideActionList &&
        overrideActionList.length > 0 &&
        !overrideActionList.includes(action.type)
      )
        continue;

      // Check all requirements
      if (action.requirements) {
        let meetsAllRequirements = true;
        for (const requirement of action.requirements) {
          if (isComparison(requirement)) {
            // Check property comparison requirement
            const unitValue = randomUnit.getPropertyValue(requirement.property);
            const conditionString = `${requirement.property} ${requirement.operator} ${requirement.value}`;
            if (
              !ConditionParser.evaluateCondition(conditionString, unitValue)
            ) {
              meetsAllRequirements = false;
              break;
            }
          }
        }
        if (!meetsAllRequirements) continue;
      }

      // Add action to available list
      availableActions.push(action);
    }

    // If no actions are available based on requirements, use all actions
    if (availableActions.length === 0) {
      availableActions = [...this.actionsData];
    }

    // Select a random action from available actions
    const selectedAction = MathUtils.getRandomFromArray(availableActions);

    // For interaction-type actions, select another unit to interact with
    let targetUnit = null;
    let targetUnitName = 'another unit';

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
      }
    }

    // Create description by replacing placeholders
    description = selectedAction.description
      .replace('{{unitName}}', unitName)
      .replace('{{unitType}}', unitType)
      .replace('{{targetUnitName}}', targetUnitName);

    // Create action payload based on action type

    return {
      turn,
      timestamp: Date.now(),
      action: {
        ...selectedAction,
        description,
        player: unitName, // Add the unit's name as the player
        payload: selectedAction.payload || {}, // Ensure payload exists
      },
    };
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

      const unitPos = WorldManager.getUnitPosition(unit);

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

      // Try to move the unit to the target position
      const moved = WorldManager.moveUnit(unit, targetX, targetY);

      return moved;
    } catch (error) {
      this.logger.error(
        `Failed to move unit to position: ${(error as Error).message}`
      );
      return false;
    }
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

          // Update the unit's position using WorldManager
          const positionToUse =
            gate.positionTo instanceof Position
              ? gate.positionTo
              : new Position(gate.positionTo.x, gate.positionTo.y);

          const updateSuccess = WorldManager.setUnitPosition(
            unit,
            gate.mapTo,
            positionToUse
          );

          if (updateSuccess) {
            this.logger.info(
              `Unit ${unitId} moved through gate from ${currentMapId}(${x},${y}) to ${gate.mapTo}(${gate.positionTo.x},${gate.positionTo.y})`
            );
          } else {
            this.logger.error(`Failed to move unit ${unitId} through gate`);
          }
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
