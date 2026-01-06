import { UnitController } from '../ai/UnitController';
import { WorldController } from '../ai/WorldController';
import { GameLoop } from './GameLoop';
import { TurnManager } from './TurnManager';
import { StoryTeller } from './StoryTeller';
import { DataManager } from '../utils/DataManager';
import { ConfigManager, type FullConfig } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import type { BaseUnit } from '@atsu/atago';
import type { EngineProps, GameState } from '../types';

/**
 * Represents the main game engine that manages the game state,
 * turn-based mechanics, and story generation.
 */
export class GameEngine {
  private gameLoop: GameLoop;
  private unitController: UnitController;
  private worldController: WorldController;
  private storyTeller: StoryTeller;
  private turnManager: TurnManager;
  private logger: Logger;
  private isRunning: boolean = false;
  private sessionTurnCount: number = 0;
  private persistentTurnOrder: string[] = [];
  private maxTurnsPerSession: number =
    ConfigManager.getConfig().maxTurnsPerSession;
  private runIndefinitely: boolean =
    ConfigManager.getConfig().runIndefinitely ?? false;
  private props: EngineProps = this.getDefaultProps();

  constructor(_props: Partial<EngineProps> = {}) {
    this.logger = new Logger({ prefix: 'GameEngine' });
    this.unitController = new UnitController();
    this.worldController = new WorldController();
    // Pass the world controller's world to the StoryTeller so they share the same world
    this.storyTeller = new StoryTeller(
      this.unitController,
      this.worldController.getWorld()
    );
    this.gameLoop = new GameLoop();
    // We'll initialize turnManager in the initialize method with a default value
    this.turnManager = new TurnManager({ turn: 0 });
    this.props = { ...this.props, ..._props };
  }

  /**
   * Initializes the game engine with the provided game state
   */
  public async initialize(gameState: GameState): Promise<void> {
    this.logger.info('Initializing game engine...');
    const config = ConfigManager.getConfig();

    if (config.clearUnitsOnStart) {
      DataManager.ensureDataDirectory();
      DataManager.saveUnits([]);
      this.logger.info('Cleared saved units before start per configuration.');
    }

    // Initialize the controllers
    await this.unitController.initialize(gameState);

    // Load the last turn number to continue from the previous session
    const lastTurn = DataManager.getLastTurnNumber();
    this.logger.info(`Starting from turn: ${lastTurn + 1}`);

    // Create a new story teller with the initialized controller and use the same world
    this.storyTeller = new StoryTeller(
      this.unitController,
      this.worldController.getWorld()
    );

    // Initialize the turn manager with the continued turn number
    const gameStateWithTurn = { ...gameState, turn: lastTurn };
    this.turnManager = new TurnManager(gameStateWithTurn);

    this.logger.info('Game engine initialized successfully.');
  }

  private beginSession(): void {
    this.logger.info('Starting game engine...');
    this.isRunning = true;
    this.sessionTurnCount = 0; // Reset session turn count

    this.props.onStart();

    // Adjust logger based on visual-only mode
    const renderingConfig = ConfigManager.getConfig().rendering;
    const disableLogger =
      renderingConfig.visualOnly && renderingConfig.showConsole !== true;
    this.logger.setProps({ disable: disableLogger });
  }

  /**
   * Starts the game loop
   */
  public start(): void {
    if (this.isRunning) {
      this.logger.warn('Game engine is already running.');
      return;
    }

    this.beginSession();

    // Start the game loop
    this.gameLoop.start(() => this.processTurnInternal());
  }

  /**
   * Starts the game engine without the automated loop; turns must be triggered manually.
   */
  public startManual(): void {
    if (this.isRunning) {
      this.logger.warn('Game engine is already running.');
      return;
    }

    this.beginSession();
    this.logger.info('Manual mode enabled: trigger turns manually.');
  }

  /**
   * Play a single turn when running in manual mode.
   */
  public async playTurn(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Cannot play turn because the engine is not running.');
      return;
    }

    await this.processTurnInternal();
  }

  /**
   * Backwards-compatible alias for playing a single turn.
   */
  public async processTurn(): Promise<void> {
    await this.playTurn();
  }

  /**
   * Processes a single turn in the game
   */
  private async processTurnInternal(): Promise<void> {
    // Ensure we have a round and turn order ready
    if (!this.turnManager.hasPendingTurns()) {
      const units = this.unitController.getUnits();
      const turnOrder = this.buildTurnOrder(units);

      if (turnOrder.length === 0) {
        this.logger.warn('No available units to act this round. Stopping.');
        this.stop();
        return;
      }

      const nextRoundNumber = Math.max(
        1,
        this.turnManager.getCurrentRound() + 1
      );
      this.turnManager.startNewRound(turnOrder, nextRoundNumber);

      const turnOrderLabels = turnOrder.map(unitId =>
        this.formatUnitLabel(
          units.find(unit => unit.id === unitId),
          unitId
        )
      );
      this.logger.info(
        `Starting round ${nextRoundNumber} with order: ${turnOrderLabels.join(', ')}`
      );
    }

    const turnOrder = this.turnManager.getTurnOrder();
    const actor = this.getNextActor();

    if (!actor) {
      this.logger.warn('Unable to find an actor for this turn, skipping.');
      return;
    }

    // Use the actual turn number from the turn manager, not the loop's turn number
    const actualTurn = this.turnManager.getCurrentTurn() + 1; // +1 because turnManager tracks the last completed turn
    const currentRound = this.turnManager.getCurrentRound();
    const turnInRound = this.turnManager.getTurnIndexInRound() + 1;

    this.props.onTurnStart(actualTurn);

    const actorLabel = this.formatUnitLabel(actor);
    this.logger.info(
      `\n--- Engine: Round ${currentRound}, Turn ${actualTurn} (unit ${turnInRound}/${turnOrder.length}: ${actorLabel}) ---`
    );

    try {
      // Use the StoryTeller to generate a story action for this turn
      const { action } = await this.storyTeller.generateStoryAction(
        actualTurn,
        {
          actorId: actor.id,
          round: currentRound,
          turnInRound,
          turnOrder,
        }
      );

      this.logger.info(`Story Action: ${action.description || action.type}`);

      // Process the action through the turn manager
      await this.turnManager.processAction(action, {
        actorId: actor.id,
        round: currentRound,
        turnInRound,
        turnOrder,
      });

      // Show the latest story
      const latestStory = this.storyTeller.getLatestStory();
      if (latestStory) {
        this.logger.info(`Narrative: ${latestStory}`);
      }

      // End the turn
      this.turnManager.endTurn();
      this.sessionTurnCount++; // Increment session turn count

      this.props.onTurnEnd(actualTurn);

      // Check if game should continue
      const shouldContinue = await this.shouldContinue();
      if (!shouldContinue) {
        this.stop();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error processing turn:', err);
      this.storyTeller.logSystemDiaryEntry(err.message, {
        turn: actualTurn,
        round: currentRound,
        turnInRound,
        turnOrder,
        actorId: actor.id,
        type: 'engine_error',
      });
      this.stop();
    }
  }

  /**
   * Determines if the game should continue
   */
  private async shouldContinue(): Promise<boolean> {
    if (this.runIndefinitely || this.maxTurnsPerSession <= 0) {
      return true;
    }

    return this.sessionTurnCount < this.maxTurnsPerSession;
  }

  /**
   * Stops the game engine
   */
  public stop(): void {
    this.logger.info('Stopping game engine...');
    this.isRunning = false;
    this.gameLoop.stop();

    this.props.onStop();

    // Save the current world state with unit names for proper rendering
    // Using a synchronous save to ensure it completes before exit
    this.saveWorldSync();
  }

  /**
   * Private method to save the world state synchronously
   */
  private saveWorldSync(): void {
    try {
      const world = this.worldController.getWorld();
      if (world.getAllMaps().length === 0) {
        throw new Error(
          'Cannot save world state because no maps are available. Please create or load maps before saving.'
        );
      }

      this.worldController.saveWorldSync();
      this.logger.info('World state saved successfully');
    } catch (error) {
      this.logger.error('Error saving world state:', error);
    }
  }

  /**
   * Gets whether the game engine is currently running
   */
  public getRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Gets the unit controller
   */
  public getUnitController(): UnitController {
    return this.unitController;
  }

  /**
   * Gets the story teller
   */
  public getStoryTeller(): StoryTeller {
    return this.storyTeller;
  }

  /**
   * Gets the turn manager
   */
  public getTurnManager(): TurnManager {
    return this.turnManager;
  }

  /**
   * Gets the world controller
   */
  public getWorldController(): WorldController {
    return this.worldController;
  }

  /**
   * Gets the default engine properties, with empty no-op callbacks
   * @returns default EngineProps object
   */
  private getDefaultProps(): EngineProps {
    return {
      onTurnStart: () => {},
      onTurnEnd: () => {},
      onStop: () => {},
      onStart: () => {},
    };
  }

  /**
   * Retrieves the full configuration of the game engine, used from config.json
   * @returns FullConfig object
   */
  public getConfig(): FullConfig {
    return ConfigManager.getConfig();
  }

  /**
   * Gets the cooldown period from configuration
   */
  public getCooldownPeriod(): number {
    return ConfigManager.getConfig().cooldownPeriod || 1;
  }

  private buildTurnOrder(units: BaseUnit[]): string[] {
    const aliveUnits = this.getAliveUnits(units);
    const aliveIds = new Set(aliveUnits.map(unit => unit.id));

    // Establish an initial, experience-weighted order once.
    if (this.persistentTurnOrder.length === 0) {
      this.persistentTurnOrder = [...aliveUnits]
        .sort((a, b) => {
          const expDiff = this.getUnitExperience(b) - this.getUnitExperience(a);
          if (expDiff !== 0) return expDiff;
          // Stable-ish tiebreaker: random first, then name to avoid identical sort results every run
          const randomTie = Math.random() - 0.5;
          if (randomTie !== 0) return randomTie;
          return a.name.localeCompare(b.name);
        })
        .map(unit => unit.id);
    }

    // Append new units (e.g., joins mid-run) to the end of the order
    const newIds = aliveUnits
      .map(unit => unit.id)
      .filter(id => !this.persistentTurnOrder.includes(id));

    if (newIds.length > 0) {
      this.persistentTurnOrder.push(...newIds);
    }

    // Return the current order filtered to alive units
    return this.persistentTurnOrder.filter(id => aliveIds.has(id));
  }

  private getAliveUnits(units: BaseUnit[]): BaseUnit[] {
    return units.filter(unit => {
      const status = unit.getPropertyValue<string>('status');
      const healthValue = unit.getPropertyValue<number>('health') ?? 0;

      return status !== 'dead' && healthValue > 0;
    });
  }

  private getNextActor(): BaseUnit | null {
    const units = this.unitController.getUnits();
    const aliveUnits = this.getAliveUnits(units);
    let actorId = this.turnManager.getCurrentActorId();
    let actor = actorId ? aliveUnits.find(unit => unit.id === actorId) : null;

    while (!actor && this.turnManager.hasPendingTurns()) {
      const actorLabel = this.formatUnitLabel(
        units.find(unit => unit.id === actorId),
        actorId
      );
      this.logger.warn(
        `Unit ${actorLabel} is unavailable; skipping their turn.`
      );
      this.turnManager.endTurn();
      actorId = this.turnManager.getCurrentActorId();
      actor = actorId ? aliveUnits.find(unit => unit.id === actorId) : null;
    }

    return actor ?? null;
  }

  private getUnitExperience(unit: BaseUnit): number {
    const exp = unit.getPropertyValue<number>('experience');
    return exp ?? 0;
  }

  private formatUnitLabel(
    unit?: BaseUnit | null,
    fallbackId?: string | null
  ): string {
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
