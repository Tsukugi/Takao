import { GameEngine } from './core/GameEngine';
import type { GameState } from './types';

/**
 * Represents a simple example game using the game engine
 */
class ExampleGame {
  private engine: GameEngine;
  private gameState: GameState;

  constructor() {
    this.engine = new GameEngine();
    this.gameState = this.createInitialState();
  }

  /**
   * Creates the initial game state
   */
  private createInitialState(): GameState {
    return {
      turn: 0,
    } as GameState;
  }

  /**
   * Starts the example game
   */
  public async start(): Promise<void> {
    console.log('Starting Example Game...\n');

    // Initialize the engine with the initial game state
    await this.engine.initialize(this.gameState);

    // Start the game
    this.engine.start();

    // Keep the process running until the game ends
    const gameEndInterval = setInterval(() => {
      if (!this.engine.getRunning()) {
        clearInterval(gameEndInterval);
        console.log('\nGame ended!');
        console.log('Thanks for playing!');
      }
    }, 1000);
  }
}

// Run the example game if this file is executed directly
if (require.main === module) {
  const game = new ExampleGame();
  game.start().catch(console.error);
}

export { ExampleGame };
