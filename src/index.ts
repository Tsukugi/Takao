import { GameEngine } from './core/GameEngine';
import type { GameState, Player } from './types';

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
    const players: Player[] = [
      {
        id: 'player1',
        name: 'AI Player 1',
        resources: { gold: 100, wood: 50, food: 80 },
      },
      {
        id: 'player2',
        name: 'AI Player 2',
        resources: { gold: 100, wood: 50, food: 80 },
      },
    ];

    return {
      turn: 0,
      players,
      board: {
        width: 10,
        height: 10,
        entities: [],
      },
      resources: {
        gold: 0,
        wood: 0,
        food: 0,
      },
    };
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
