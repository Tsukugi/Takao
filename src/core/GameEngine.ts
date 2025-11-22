import { AIController } from '../ai/AIController';
import { GameLoop } from './GameLoop';
import { TurnManager } from './TurnManager';
import type { GameState } from '../types';

/**
 * Represents the main game engine that manages the game state,
 * turn-based mechanics, and AI interactions.
 */
export class GameEngine {
  private gameLoop: GameLoop;
  private aiController: AIController;
  private turnManager: TurnManager;
  private isRunning: boolean = false;

  constructor() {
    this.aiController = new AIController();
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
    await this.aiController.initialize(gameState);
    this.turnManager = new TurnManager(gameState);
    console.log('Game engine initialized successfully.');
  }

  /**
   * Starts the game loop
   */
  public start(): void {
    console.log('Starting game engine...');
    this.isRunning = true;

    // Start the game loop
    this.gameLoop.start((turn: number) => {
      this.processTurn(turn);
    });
  }

  /**
   * Processes a single turn in the game
   */
  private async processTurn(turn: number): Promise<void> {
    console.log(`\n--- Turn ${turn} ---`);

    try {
      // Get AI action for this turn
      const action = await this.aiController.getAction(turn);
      console.log(`AI Action: ${JSON.stringify(action)}`);

      // Process the action through the turn manager
      await this.turnManager.processAction(action);

      // End the turn
      this.turnManager.endTurn();

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
    // For now, let's just continue for a fixed number of turns
    return this.turnManager.getCurrentTurn() < 10; // Stop after 10 turns
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
