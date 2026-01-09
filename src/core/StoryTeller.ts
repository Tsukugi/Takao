/**
 * Extended StoryTeller that can manage maps in addition to narrative generation
 * Uses MapGenerator to create and manage game world maps that players can move between
 */

import { UnitController } from '../ai/UnitController';
import type {
  Action,
  ActionPayload,
  ExecutedAction,
  ActionsData,
  DiaryEntry,
  StatChange,
  TurnContext,
} from '../types';
import { DataManager } from '../utils/DataManager';
import { ConfigManager } from '../utils/ConfigManager';
import { StatTracker } from '../utils/StatTracker';
import { ActionProcessor } from '../utils/ActionProcessor';
import { MathUtils } from '../utils/Math';
import { ConditionParser } from '../utils/ConditionParser';
import { BaseUnit, type IUnitPosition } from '@atsu/atago';
import {
  isComparison,
  isMovementPath,
  isRecord,
  isUnitPosition,
} from '../types/typeGuards';
import { MapGenerator } from '../utils/MapGenerator';
import { World, Map as ChoukaiMap, Position } from '@atsu/choukai';
import { GateSystem } from '../utils/GateSystem';
import { Logger } from '../utils/Logger';
import { UnitPosition } from '../utils/UnitPosition';
import { GoalSystem } from '../ai/goals/GoalSystem';
import { RelationshipHelper } from '../utils/RelationshipHelper';
import { WorldManager, type MovementStepHandler } from './WorldManager';

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
  private worldManager: WorldManager;
  private logger: Logger;
  private actionProcessor: ActionProcessor;
  private movementStepHandler: MovementStepHandler | undefined;

  constructor(unitController: UnitController, world?: World) {
    const renderingConfig = ConfigManager.getConfig().rendering;
    const disableLogger =
      renderingConfig.visualOnly && renderingConfig.showConsole !== true;
    this.logger = new Logger({
      prefix: 'StoryTeller',
      disable: disableLogger,
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
      // Load existing world from file if available, otherwise fail early
      const loadedWorld = DataManager.loadWorld();
      if (!loadedWorld) {
        throw new Error(
          'No world available; please create or load maps before starting StoryTeller.'
        );
      }
      this.logger.info(
        `loaded world with ${loadedWorld.getAllMaps().length} maps from saved state`
      );
      this.world = loadedWorld;
    }

    this.gateSystem = new GateSystem();
    this.worldManager = new WorldManager(
      this.world,
      this.unitController,
      this.gateSystem,
      this.logger
    );
    const movementStepCooldown =
      ConfigManager.getConfig().movementStepCooldownMs ?? 0;
    this.worldManager.setMovementStepCooldown(movementStepCooldown);

    // Ensure the action processor knows about the current world for range validation
    this.actionProcessor.setWorld(this.world);
  }

  /**
   * Register a handler to be called after each movement step.
   */
  public setMovementStepHandler(handler?: MovementStepHandler | null): void {
    this.movementStepHandler = handler ?? undefined;
  }

  /**
   * Generates a story action based on the current unit states
   */
  public async generateStoryAction(
    turn: number,
    context: Partial<TurnContext> = {}
  ): Promise<ExecutedAction> {
    // Get the current state of units from the UnitController
    const units = await this.unitController.getUnitState();
    const preferredActor = context.actorId
      ? units.find(unit => unit.id === context.actorId)
      : undefined;

    // Build candidate actions (in priority order) for the turn
    const { executions: actionCandidates, actor } =
      await this.createStoryBasedOnUnits(units, turn, context, preferredActor);

    // Take a snapshot of unit properties before action execution
    const initialStates = StatTracker.takeSnapshot(units);

    // Try candidates until one succeeds; fall back to default idle action
    const safeContext = this.getSafeContext(context);
    let storyAction: ExecutedAction =
      this.actionProcessor.getDefaultExecutedAction(actor, turn, safeContext);

    const finalizeAction = async (
      candidate: ExecutedAction
    ): Promise<ExecutedAction> => {
      await this.applyPlannedMove(candidate);
      actor.setProperty('lastActionTurn', turn);
      return candidate;
    };

    for (const candidate of actionCandidates) {
      const result = await this.actionProcessor.executeActionEffect(
        candidate.action,
        units
      );
      if (result.success) {
        storyAction = await finalizeAction(candidate);
        break;
      }

      const movedTowardsTarget =
        Boolean(candidate.action.payload?.movedTowardsTarget) &&
        result.failureType === 'range';
      if (movedTowardsTarget) {
        this.logger.info(
          `Action ${candidate.action.type} could not execute; applying planned move instead`
        );
        storyAction = await finalizeAction(candidate);
        break;
      }

      this.logger.warn(
        `Action ${candidate.action.type} failed (${result.errorMessage || 'unknown reason'}), trying next candidate`
      );

      if (candidate.action.payload?.movedTowardsTarget) {
        const targetId = candidate.action.payload?.targetUnit;
        const targetIdValue =
          typeof targetId === 'string' ? targetId : undefined;
        const targetUnit = targetIdValue
          ? units.find(unit => unit.id === targetIdValue)
          : undefined;
        const targetLabel = this.formatUnitLabel(targetUnit, targetIdValue);
        this.logger.info(
          `Planned move toward ${targetLabel} skipped because ${candidate.action.type} failed`
        );
      }
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

    // Enrich the executed action with contextual metadata
    const metadata = this.getExecutionMetadata(storyAction, context);
    storyAction = { ...storyAction, ...metadata };

    // Save the current unit states and diary entry
    this.saveUnits();
    this.saveDiaryEntry(storyAction, turn, changes, context);

    return storyAction;
  }

  /**
   * Creates a story action based on unit states
   */
  private async createStoryBasedOnUnits(
    units: BaseUnit[],
    turn: number,
    context: Partial<TurnContext>,
    forcedActor?: BaseUnit
  ): Promise<{ executions: ExecutedAction[]; actor: BaseUnit }> {
    // If no units exist, create a default action
    if (units.length === 0) {
      // Return a default narrative action instead of throwing
      return this.buildDefaultStory(turn);
    }

    // Filter out dead units - only consider alive units for taking actions
    const aliveUnits = units.filter(unit => this.isUnitAlive(unit));

    if (forcedActor && !this.isUnitAlive(forcedActor)) {
      return this.buildDefaultStory(turn, forcedActor);
    }

    // Filter units by cooldown - units can only act once every few turns
    const cooldownPeriod = ConfigManager.getConfig().cooldownPeriod || 1; // Default to 1 (every turn)
    const now = turn;
    const availableUnits = aliveUnits.filter(unit => {
      const lastTurn =
        unit.getPropertyValue<number>('lastActionTurn') ?? -Infinity;
      return now - lastTurn >= cooldownPeriod;
    });

    // If no units are available due to cooldown, use all alive units (reset cooldowns)
    const unitsToConsider =
      forcedActor && this.isUnitAlive(forcedActor)
        ? [forcedActor]
        : availableUnits.length > 0
          ? availableUnits
          : aliveUnits;

    // If no alive units exist, return a default action
    if (aliveUnits.length === 0) {
      return this.buildDefaultStory(turn);
    }

    // Choose a random alive unit to center the story around
    const randomUnit =
      (forcedActor && this.isUnitAlive(forcedActor) ? forcedActor : null) ??
      MathUtils.getRandomFromArray(unitsToConsider);

    const availableActions = this.getAvailableActionsForUnit(randomUnit);

    const goalChoice = this.goalSystem.chooseAction(randomUnit, {
      availableActions,
      units,
      turn,
    });

    const goalCandidates = goalChoice.goalCandidates ?? [];

    if (goalCandidates.length > 0) {
      this.logger.info(
        `Goal evaluation for ${this.formatUnitLabel(randomUnit)} (turn ${turn}):`
      );
      for (const candidate of goalCandidates) {
        const goalLabel = candidate.goal.label
          ? `${candidate.goal.label} (${candidate.goal.id})`
          : candidate.goal.id;
        const actionList =
          candidate.actions.length > 0
            ? candidate.actions.map(action => action.type).join(', ')
            : 'none';
        this.logger.info(
          `  ${goalLabel} score ${candidate.score}: ${candidate.reason}. Actions: ${actionList}`
        );
      }
    } else {
      this.logger.info(
        `Goal evaluation for ${this.formatUnitLabel(randomUnit)} (turn ${turn}): no scored goals`
      );
    }

    const chosenActionType = goalChoice.action?.type ?? 'none';
    if (goalChoice.goal) {
      const chosenGoalLabel = goalChoice.goal.label
        ? `${goalChoice.goal.label} (${goalChoice.goal.id})`
        : goalChoice.goal.id;
      this.logger.info(
        `Goal selection: ${chosenGoalLabel} -> ${chosenActionType} (${goalChoice.reason ?? 'no reason'})`
      );
    } else {
      this.logger.info(
        `Goal selection: none -> ${chosenActionType} (${goalChoice.reason ?? 'no reason'})`
      );
    }

    const prioritizedActions =
      goalChoice?.candidateActions && goalChoice.candidateActions.length > 0
        ? goalChoice.candidateActions
        : availableActions;

    const prioritizedActionTypes =
      prioritizedActions.length > 0
        ? prioritizedActions.map(action => action.type).join(', ')
        : 'none';
    const hasGoalActions = goalCandidates.some(
      candidate => candidate.actions.length > 0
    );
    const prioritizedSource = hasGoalActions ? 'goal' : 'fallback';
    this.logger.info(
      `Prioritized actions (${prioritizedSource}): ${prioritizedActionTypes}`
    );

    const executions: ExecutedAction[] = [];

    for (const actionDef of prioritizedActions) {
      const execution = await this.prepareActionExecution(
        randomUnit,
        actionDef,
        units,
        turn
      );
      if (execution) {
        executions.push(execution);
      }
    }

    // Always include a safe default at the end
    executions.push(
      this.actionProcessor.getDefaultExecutedAction(
        randomUnit,
        turn,
        this.getSafeContext(context)
      )
    );

    return { executions, actor: randomUnit };
  }

  /**
   * Builds an ExecutedAction for a unit and action definition, handling targets and movement.
   */
  private async prepareActionExecution(
    unit: BaseUnit,
    actionDef: Action,
    units: BaseUnit[],
    turn: number
  ): Promise<ExecutedAction | null> {
    const targetUnit = this.selectTargetForAction(unit, actionDef, units);
    if (this.requiresTarget(actionDef.type) && !targetUnit) {
      this.logger.info(
        `Skipping action ${actionDef.type} for ${this.formatUnitLabel(
          unit
        )}: no valid target`
      );
      return null;
    }

    const basePayload = this.buildBasePayload(actionDef, targetUnit);
    const payloadWithTarget: ActionPayload = {
      ...basePayload,
      ...(targetUnit ? { targetUnit: targetUnit.id } : {}),
    };

    const movementPlan = this.planMovementForAction({
      actionDef,
      unit,
      targetUnit,
      units,
    });

    const finalPayload: ActionPayload = {
      ...payloadWithTarget,
      ...movementPlan.payload,
    };

    const description = this.buildDescription(
      actionDef,
      unit.name,
      unit.type,
      targetUnit?.name ?? 'another unit',
      movementPlan.movedTowardsTarget
    );

    return {
      turn,
      timestamp: Date.now(),
      action: {
        ...actionDef,
        description,
        player: unit.id,
        payload: finalPayload,
      },
    };
  }

  private buildDescription(
    actionDef: Action,
    unitName: string,
    unitType: string,
    targetUnitName: string,
    movedTowardsTarget: boolean
  ): string {
    if (movedTowardsTarget) {
      return `${unitName} is moving closer to ${targetUnitName}`;
    }

    return actionDef.description
      .replace('{{unitName}}', unitName)
      .replace('{{unitType}}', unitType)
      .replace('{{targetUnitName}}', targetUnitName);
  }

  private buildBasePayload(
    actionDef: Action,
    targetUnit: BaseUnit | null
  ): ActionPayload {
    if (!actionDef.payload) {
      return {};
    }

    return ActionProcessor.processActionPayload(actionDef.payload, targetUnit);
  }

  private selectTargetForAction(
    unit: BaseUnit,
    actionDef: Action,
    units: BaseUnit[]
  ): BaseUnit | null {
    if (!this.requiresTarget(actionDef.type) || units.length <= 1) {
      return null;
    }

    const otherUnits = units.filter(u => u.id !== unit.id);
    const aliveTargets = otherUnits.filter(u => this.isUnitAlive(u));
    let candidateTargets = aliveTargets;

    if (this.requiresHostileTarget(actionDef.type)) {
      candidateTargets = aliveTargets.filter(u =>
        RelationshipHelper.isHostile(unit, u)
      );
      if (candidateTargets.length === 0) {
        return null;
      }
    } else if (this.requiresAllyTarget(actionDef.type)) {
      candidateTargets = aliveTargets.filter(u =>
        RelationshipHelper.isAlly(unit, u)
      );
    }

    if (candidateTargets.length === 0) {
      candidateTargets = aliveTargets;
    }

    if (candidateTargets.length === 0) {
      return null; // No valid target for this action
    }

    const actionRange = this.actionProcessor.getActionRange(actionDef);
    const candidatesWithDistance = candidateTargets.map(target => ({
      target,
      distance: UnitPosition.getDistanceBetweenUnits(
        units,
        unit.id,
        target.id,
        true
      ),
    }));

    const reachable = candidatesWithDistance.filter(
      c => c.distance !== Infinity
    );
    const considered =
      reachable.length > 0 ? reachable : candidatesWithDistance;
    const inRange = considered.filter(c => c.distance <= actionRange);
    const selectionPool = inRange.length > 0 ? inRange : considered;
    selectionPool.sort((a, b) => a.distance - b.distance);

    const chosen = selectionPool[0]?.target ?? null;
    return chosen;
  }

  private planMovementForAction({
    actionDef,
    unit,
    targetUnit,
    units,
  }: {
    actionDef: Action;
    unit: BaseUnit;
    targetUnit: BaseUnit | null;
    units: BaseUnit[];
  }): { payload: ActionPayload; movedTowardsTarget: boolean } {
    const payload: ActionPayload = {};

    if (actionDef.type === 'explore') {
      try {
        const steps = this.worldManager.planExploreMovement(unit, units);
        const [firstStep] = steps;
        if (!firstStep) {
          return { payload, movedTowardsTarget: false };
        }

        payload.unitId = unit.id;
        payload.mapId = firstStep.mapId;
        payload.position = new Position(
          firstStep.position.x,
          firstStep.position.y
        );
        payload.movedTo = {
          x: firstStep.position.x,
          y: firstStep.position.y,
        };
        payload.movementPath = steps.map(step => ({
          mapId: step.mapId,
          position: {
            x: step.position.x,
            y: step.position.y,
            ...(step.position.z !== undefined ? { z: step.position.z } : {}),
          },
        }));

        return { payload, movedTowardsTarget: false };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Unable to plan explore move for ${this.formatUnitLabel(
            unit
          )}: ${err.message}`
        );
        return { payload, movedTowardsTarget: false };
      }
    }

    if (!targetUnit) {
      return { payload, movedTowardsTarget: false };
    }

    const actionRange = this.actionProcessor.getActionRange(actionDef);
    try {
      const plan = this.worldManager.planMovementTowardTarget(
        unit,
        targetUnit,
        units,
        actionRange
      );

      const [firstStep] = plan.steps;
      if (firstStep) {
        payload.movedTowardsTarget = plan.movedTowardsTarget;
        payload.movedTo = {
          x: firstStep.position.x,
          y: firstStep.position.y,
        };
        payload.unitId = unit.id;
        payload.mapId = firstStep.mapId;
        payload.position = new Position(
          firstStep.position.x,
          firstStep.position.y
        );
        payload.movementPath = plan.steps.map(step => ({
          mapId: step.mapId,
          position: {
            x: step.position.x,
            y: step.position.y,
            ...(step.position.z !== undefined ? { z: step.position.z } : {}),
          },
        }));
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(
        `Unable to plan move for ${this.formatUnitLabel(
          unit
        )} toward ${this.formatUnitLabel(targetUnit)} (${actionDef.type}): ${
          err.message
        }`
      );
    }

    return { payload, movedTowardsTarget: Boolean(payload.movedTowardsTarget) };
  }

  private requiresHostileTarget(actionType: string): boolean {
    return [
      'attack',
      'desperate_attack',
      'ranged_attack',
      'shoot',
      'stab',
      'melee',
      'cast_attack',
    ].includes(actionType);
  }

  private requiresAllyTarget(actionType: string): boolean {
    return ['support', 'heal', 'inspire'].includes(actionType);
  }

  private requiresTarget(actionType: string): boolean {
    return ['interact', 'attack', 'support', 'trade', 'inspire'].includes(
      actionType
    );
  }

  private isUnitAlive(unit: BaseUnit): boolean {
    const status = unit.getPropertyValue<string>('status');
    if (status === 'dead') {
      return false;
    }

    const healthValue = unit.getPropertyValue<number>('health');

    if (!healthValue || healthValue <= 0) {
      return false;
    }

    return true;
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
            const unitValue = unit.requirePropertyValue<number>(
              requirement.property
            );
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

  private createDefaultActor(): BaseUnit {
    return new BaseUnit('default-unit', 'DefaultUnit', 'unknown', {});
  }

  private buildDefaultStory(
    turn: number,
    actor?: BaseUnit
  ): { executions: ExecutedAction[]; actor: BaseUnit } {
    const resolvedActor = actor ?? this.createDefaultActor();
    return {
      actor: resolvedActor,
      executions: [
        this.actionProcessor.getDefaultExecutedAction(resolvedActor, turn),
      ],
    };
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
   * Replace the current world reference (used by integration fallback).
   */
  public setWorld(world: World): void {
    this.world = world;
    this.worldManager.setWorld(world);
    this.actionProcessor.setWorld(world);
  }

  /**
   * Gets the world manager that owns gate and movement operations.
   */
  public getWorldManager(): WorldManager {
    return this.worldManager;
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
  public saveDiaryEntry(
    executedAction: ExecutedAction,
    turn: number,
    statChanges: StatChange[] = [],
    context: Partial<TurnContext> = {}
  ): void {
    const formattedChanges = this.formatStatChangeSummary(statChanges);
    const statChangesByUnit = this.formatStatChangesByUnit(statChanges);
    const statChangesFormatted = this.formatStatChangesBlocks(statChanges);
    const round = context.round ?? executedAction.round;
    const turnInRound = context.turnInRound ?? executedAction.turnInRound;

    if (round === undefined || turnInRound === undefined) {
      throw new Error('Diary entry is missing round or turnInRound data.');
    }

    const turnOrder = context.turnOrder ?? executedAction.turnOrder ?? [];
    const actorId =
      context.actorId ?? executedAction.actorId ?? executedAction.action.player;
    const diaryEntry: DiaryEntry = {
      turn,
      timestamp: new Date().toISOString(),
      action: executedAction.action,
      round,
      turnInRound,
      turnOrder,
      actorId,
      statChanges,
      statChangesSummary: formattedChanges,
      statChangesByUnit,
      statChangesFormatted,
    };

    DataManager.saveDiaryEntry(diaryEntry);
    this.diary.push(diaryEntry);
  }

  /**
   * Logs a system-level diary entry (e.g., errors) so renderers can display it.
   */
  public logSystemDiaryEntry(
    message: string,
    context: {
      turn?: number;
      round?: number;
      turnInRound?: number;
      turnOrder?: string[];
      actorId?: string;
      type?: string;
    } = {}
  ): void {
    const last = this.diary[this.diary.length - 1];
    const turn = context.turn ?? last?.turn ?? 0;
    const round = context.round ?? last?.round ?? 0;
    const turnInRound = context.turnInRound ?? last?.turnInRound ?? 0;
    const turnOrder = context.turnOrder ?? last?.turnOrder ?? [];
    const actorId = context.actorId ?? 'system';

    const action: Action = {
      player: actorId,
      type: context.type ?? 'system_error',
      description: message,
      payload: { severity: 'error' },
    };

    const diaryEntry: DiaryEntry = {
      turn,
      timestamp: new Date().toISOString(),
      action,
      round,
      turnInRound,
      turnOrder,
      actorId,
      statChanges: [],
      statChangesSummary: [],
      statChangesByUnit: {},
      statChangesFormatted: [],
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
   * Builds human-readable stat change summaries grouped by unit.
   */
  private formatStatChangeSummary(statChanges: StatChange[]): string[] {
    if (statChanges.length === 0) return [];

    const grouped = StatTracker.groupChangesByUnit(statChanges);
    const summaries: string[] = [];

    for (const [, changes] of grouped) {
      const label = changes[0]?.unitName || 'Unknown';
      const formatted = StatTracker.formatStatChanges(changes);
      summaries.push(`${label}: ${formatted.join(', ')}`);
    }

    return summaries;
  }

  /**
   * Builds stat change arrays keyed by unit name (for clearer diary JSON).
   */
  private formatStatChangesByUnit(
    statChanges: StatChange[]
  ): Record<string, string[]> {
    if (statChanges.length === 0) return {};

    const grouped = StatTracker.groupChangesByUnit(statChanges);
    const byUnit: Record<string, string[]> = {};

    const sorted = Array.from(grouped.values()).sort((a, b) => {
      const nameA = (a[0]?.unitName || '').toLowerCase();
      const nameB = (b[0]?.unitName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    for (const changes of sorted) {
      const label = changes[0]?.unitName || 'Unknown';
      byUnit[label] = StatTracker.formatStatChanges(changes);
    }

    return byUnit;
  }

  /**
   * Builds stat change blocks with unit name and formatted change lines.
   */
  private formatStatChangesBlocks(
    statChanges: StatChange[]
  ): Array<{ unit: string; changes: string[] }> {
    if (statChanges.length === 0) return [];

    const grouped = StatTracker.groupChangesByUnit(statChanges);

    const blocks = Array.from(grouped.values())
      .map(changes => ({
        unit: changes[0]?.unitName || 'Unknown',
        changes: StatTracker.formatStatChanges(changes),
      }))
      .sort((a, b) => a.unit.toLowerCase().localeCompare(b.unit.toLowerCase()));

    return blocks;
  }

  /**
   * Build a direct context object for executed actions.
   */
  private getSafeContext(
    context: Partial<TurnContext>
  ): Pick<ExecutedAction, 'round' | 'turnInRound' | 'turnOrder'> {
    const { round, turnInRound, turnOrder } = context;

    if (round === undefined || turnInRound === undefined) {
      throw new Error(
        'Turn context requires both round and turnInRound to be defined.'
      );
    }

    return {
      round,
      turnInRound,
      turnOrder: turnOrder ? [...turnOrder] : [],
    };
  }

  /**
   * Merge contextual metadata into an executed action.
   */
  private getExecutionMetadata(
    executedAction: ExecutedAction,
    context: Partial<TurnContext>
  ): Partial<ExecutedAction> {
    const round = context.round ?? executedAction.round;
    const turnInRound = context.turnInRound ?? executedAction.turnInRound;

    if (round === undefined || turnInRound === undefined) {
      throw new Error('Executed action is missing round or turnInRound data.');
    }

    const turnOrder = context.turnOrder ?? executedAction.turnOrder ?? [];
    const actorId =
      context.actorId ?? executedAction.actorId ?? executedAction.action.player;

    return {
      round,
      turnInRound,
      turnOrder: [...turnOrder],
      actorId: actorId,
    };
  }

  /**
   * Applies any planned movement after an action succeeds.
   */
  private async applyPlannedMove(
    executedAction: ExecutedAction
  ): Promise<void> {
    const payload = executedAction.action.payload;
    if (!payload) return;

    try {
      if (isRecord(payload) && isMovementPath(payload.movementPath)) {
        await this.worldManager.applyMovementPath(
          executedAction.action.player,
          payload.movementPath,
          this.movementStepHandler
        );
        return;
      }

      if (!isUnitPosition(payload)) return;

      const success = await this.worldManager.moveUnitToPosition(
        executedAction.action.player,
        payload.position.x,
        payload.position.y
      );

      if (!success) {
        const unit = this.unitController
          .getUnits()
          .find(u => u.id === executedAction.action.player);
        if (!unit) {
          throw new Error(
            `Planned move failed because unit ${executedAction.action.player} was not found.`
          );
        }
        const currentPos = unit.requirePropertyValue<IUnitPosition>('position');
        unit.setProperty('position', {
          unitId: unit.id,
          mapId: payload.mapId ?? currentPos.mapId,
          position: new Position(payload.position.x, payload.position.y),
        });
      }
    } catch (error) {
      this.logger.warn(
        `Planned move failed for ${executedAction.action.player}: ${(error as Error).message}`
      );
    }
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
