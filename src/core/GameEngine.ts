import { UnitController } from '../ai/UnitController';
import { GameLoop } from './GameLoop';
import { TurnManager } from './TurnManager';
import { StoryTeller } from './StoryTeller';
import { DataManager } from '../utils/DataManager';
import type { GameState } from '../types';

/**
 * Represents the main game engine that manages the game state,
 * turn-based mechanics, and story generation.
 */
export class GameEngine {
  private gameLoop: GameLoop;
  private unitController: UnitController;
  private storyTeller: StoryTeller;
  private turnManager: TurnManager;
  private isRunning: boolean = false;
  private sessionTurnCount: number = 0;
  private maxTurnsPerSession: number = 10;

  constructor() {
    this.unitController = new UnitController();
    this.storyTeller = new StoryTeller(this.unitController);
    this.gameLoop = new GameLoop();
    // We'll initialize turnManager in the initialize method with a default value
    this.turnManager = new TurnManager({ turn: 0, players: [] });
  }

  /**
   * Initializes the game engine with the provided game state
   */
  public async initialize(gameState: GameState): Promise<void> {
    console.log('Initializing game engine...');
    // Initialize the game state
    await this.unitController.initialize(gameState);
    // Create a new story teller with the initialized controller
    this.storyTeller = new StoryTeller(this.unitController);

    // Load the last turn number to continue from the previous session
    const lastTurn = DataManager.getLastTurnNumber();
    console.log(`Starting from turn: ${lastTurn + 1}`);

    // Initialize the turn manager with the continued turn number
    const gameStateWithTurn = { ...gameState, turn: lastTurn };
    this.turnManager = new TurnManager(gameStateWithTurn);

    console.log('Game engine initialized successfully.');
  }

  /**
   * Starts the game loop
   */
  public start(): void {
    console.log('Starting game engine...');
    this.isRunning = true;
    this.sessionTurnCount = 0; // Reset session turn count

    // Start the game loop
    this.gameLoop.start((turn: number) => {
      this.processTurn(turn);
    });
  }

  /**
   * Processes a single turn in the game
   */
  private async processTurn(turn: number): Promise<void> {
    // Use the actual turn number from the turn manager, not the loop's turn number
    const actualTurn = this.turnManager.getCurrentTurn() + 1; // +1 because turnManager tracks the last completed turn
    console.log(`\n--- Turn ${actualTurn} ---`);

    try {
      // Use the StoryTeller to generate a story action for this turn
      const storyAction = await this.storyTeller.generateStoryAction(actualTurn);

      console.log(`Story Action: ${storyAction.payload.description || storyAction.type}`);

      // Process the action through the turn manager
      await this.turnManager.processAction(storyAction);

      // Show the latest story
      const latestStory = this.storyTeller.getLatestStory();
      if (latestStory) {
        console.log(`Narrative: ${latestStory}`);
      }

      // End the turn
      this.turnManager.endTurn();
      this.sessionTurnCount++; // Increment session turn count

      // Check if game should continue
      const shouldContinue = await this.shouldContinue();
      if (!shouldContinue) {
        this.stop();
      }
    } catch (error) {
      console.error('Error processing turn:', error);
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
    console.log('Stopping game engine...');
    this.isRunning = false;
    this.gameLoop.stop();
  }

  /**
   * Gets whether the game engine is currently running
   */
  public getRunning(): boolean {
    return this.isRunning;
  }
}
