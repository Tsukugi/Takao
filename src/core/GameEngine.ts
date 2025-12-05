import { UnitController } from '../ai/UnitController';
import { WorldController } from '../ai/WorldController';
import { GameLoop } from './GameLoop';
import { TurnManager } from './TurnManager';
import { StoryTeller } from './StoryTeller';
import { DataManager } from '../utils/DataManager';
import { ConfigManager, type FullConfig } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
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
  private maxTurnsPerSession: number =
    ConfigManager.getConfig().maxTurnsPerSession;
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

  /**
   * Starts the game loop
   */
  public start(): void {
    this.logger.info('Starting game engine...');
    this.isRunning = true;
    this.sessionTurnCount = 0; // Reset session turn count

    this.props.onStart();

    // Adjust logger based on visual-only mode
    const isVisualOnlyMode = ConfigManager.getConfig().rendering.visualOnly;
    this.logger.setProps({ disable: isVisualOnlyMode });

    // Start the game loop
    this.gameLoop.start(() => this.processTurn());
  }

  /**
   * Processes a single turn in the game
   */
  private async processTurn(): Promise<void> {
    // Use the actual turn number from the turn manager, not the loop's turn number
    const actualTurn = this.turnManager.getCurrentTurn() + 1; // +1 because turnManager tracks the last completed turn

    this.props.onTurnStart(actualTurn);

    this.logger.info(`\n--- Engine: Turn ${actualTurn} ---`);

    try {
      // Use the StoryTeller to generate a story action for this turn
      const { action } = await this.storyTeller.generateStoryAction(actualTurn);

      this.logger.info(`Story Action: ${action.description || action.type}`);

      // Process the action through the turn manager
      await this.turnManager.processAction(action);

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
      this.logger.error('Error processing turn:', error);
      this.stop();
    }
  }

  /**
   * Determines if the game should continue
   */
  private async shouldContinue(): Promise<boolean> {
    // This will be implemented by the specific game
    // For now, let's continue for a fixed number of turns per session
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
   * Gets the current turn number from the turn manager
   */
  public getCurrentTurn(): number {
    return this.turnManager.getCurrentTurn();
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
}
