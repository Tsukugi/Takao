import type { GameState, Action, Turn } from '../types';

/**
 * Represents the turn manager that handles turn-based mechanics
 */
export class TurnManager {
  private gameState: GameState;
  private currentTurn: number = 0;
  private history: Turn[] = [];
  private players: string[] = [];
  private currentPlayerIndex: number = 0;

  constructor(initialState: GameState) {
    this.gameState = { ...initialState };
    this.currentTurn = initialState.turn || 0;
    this.players = initialState.players?.map(player => player.id) || [];
    this.currentPlayerIndex = 0;
  }

  /**
   * Gets the current game state
   */
  public getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Processes an action for the current turn
   */
  public async processAction(action: Action): Promise<void> {
    // Validate the action
    if (!this.isValidAction(action)) {
      throw new Error(`Invalid action: ${JSON.stringify(action)}`);
    }

    // Apply the action to the game state
    this.gameState = this.applyActionToState(this.gameState);

    // Add action to the turn history
    const currentTurn = this.history.find(t => t.number === this.currentTurn);
    if (currentTurn) {
      currentTurn.actions.push(action);
      currentTurn.stateAfter = this.gameState;
    } else {
      this.history.push({
        number: this.currentTurn,
        actions: [action],
        stateBefore: { ...this.gameState }, // This is after the action, so we need to store the before state differently
        stateAfter: { ...this.gameState },
      });
    }
  }

  /**
   * Validates an action against the current game state
   */
  private isValidAction(action: Action): boolean {
    // In a real implementation, this would validate the action against game rules
    // For now, we just check that the action has a type and player
    return !!action.type && !!action.player;
  }

  /**
   * Applies an action to the game state
   */
  private applyActionToState(state: GameState): GameState {
    // TODO: Implement actual game logic to modify the state based on the action
    return state;
  }

  /**
   * Ends the current turn and advances to the next turn
   */
  public endTurn(): void {
    this.currentTurn++;
    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.players.length;

    // Update the game state with the new turn
    this.gameState.turn = this.currentTurn;
  }

  /**
   * Gets the current turn number
   */
  public getCurrentTurn(): number {
    return this.currentTurn;
  }

  /**
   * Gets the current player
   */
  public getCurrentPlayer(): string {
    if (this.players.length === 0) return '';
    const player = this.players[this.currentPlayerIndex];
    return player || '';
  }

  /**
   * Gets the action history
   */
  public getHistory(): Turn[] {
    return [...this.history];
  }

  /**
   * Resets the turn manager to the initial state
   */
  public reset(): void {
    this.currentTurn = 0;
    this.history = [];
    this.currentPlayerIndex = 0;
  }
}
