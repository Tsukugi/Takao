import type { GameState, Action, Turn, TurnContext } from '../types';

/**
 * Represents the turn manager that handles turn-based mechanics
 */
export class TurnManager {
  private gameState: GameState;
  private currentTurn: number = 0;
  private currentRound: number = 0;
  private turnOrder: string[] = [];
  private turnIndexInRound: number = 0;
  private roundInProgress: boolean = false;
  private history: Turn[] = [];

  constructor(initialState: GameState) {
    this.gameState = { ...initialState };
    this.currentTurn = initialState.turn || 0;
    this.currentRound = initialState.round || 0;
    this.turnOrder = initialState.turnOrder ? [...initialState.turnOrder] : [];
    this.turnIndexInRound = initialState.turnInRound || 0;
    this.roundInProgress =
      this.turnOrder.length > 0 &&
      this.turnIndexInRound >= 0 &&
      this.turnIndexInRound < this.turnOrder.length;
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
  public async processAction(
    action: Action,
    context?: Partial<TurnContext>
  ): Promise<void> {
    // Validate the action
    if (!this.isValidAction(action)) {
      throw new Error(`Invalid action: ${JSON.stringify(action)}`);
    }

    const stateBefore = { ...this.gameState };

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
        round: context?.round ?? this.currentRound,
        turnInRound: context?.turnInRound ?? this.turnIndexInRound + 1,
        turnOrder: context?.turnOrder
          ? [...context.turnOrder]
          : [...this.turnOrder],
        actorId: context?.actorId ?? action.player,
        actions: [action],
        stateBefore,
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
   * Starts a new round with the provided turn order
   */
  public startNewRound(turnOrder: string[], roundNumber?: number): void {
    if (turnOrder.length === 0) {
      throw new Error('Cannot start a round with an empty turn order');
    }

    if (this.roundInProgress) {
      throw new Error('Cannot start a new round while one is in progress');
    }

    const nextRound =
      roundNumber !== undefined && roundNumber !== null
        ? roundNumber
        : this.currentRound + 1 || 1;

    this.currentRound = nextRound;
    this.turnOrder = [...turnOrder];
    this.turnIndexInRound = 0;
    this.roundInProgress = true;

    this.gameState.round = this.currentRound;
    this.gameState.turnInRound = 0;
    this.gameState.turnOrder = [...turnOrder];
  }

  /**
   * Gets the current round number (last started round)
   */
  public getCurrentRound(): number {
    return this.currentRound;
  }

  /**
   * Gets the current turn order for the active round
   */
  public getTurnOrder(): string[] {
    return [...this.turnOrder];
  }

  /**
   * Gets the index of the next actor in the current round (0-based)
   */
  public getTurnIndexInRound(): number {
    return this.roundInProgress ? this.turnIndexInRound : 0;
  }

  /**
   * Gets the current actor id for this turn, if any.
   */
  public getCurrentActorId(): string | null {
    if (!this.roundInProgress) {
      return null;
    }

    return this.turnOrder[this.turnIndexInRound] ?? null;
  }

  /**
   * Checks if the current round has remaining turns
   */
  public hasPendingTurns(): boolean {
    return (
      this.roundInProgress && this.turnIndexInRound < this.turnOrder.length
    );
  }

  /**
   * Ends the current turn and advances to the next turn
   */
  public endTurn(): void {
    this.currentTurn++;

    // Update the game state with the new turn
    this.gameState.turn = this.currentTurn;

    if (this.roundInProgress) {
      this.turnIndexInRound++;
      this.gameState.turnInRound = this.turnIndexInRound;
      if (this.turnIndexInRound >= this.turnOrder.length) {
        this.roundInProgress = false;
        this.turnOrder = [];
        this.turnIndexInRound = 0;
        this.gameState.turnOrder = [];
      }
    }
  }

  /**
   * Gets the current turn number
   */
  public getCurrentTurn(): number {
    return this.currentTurn;
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
    this.currentRound = 0;
    this.roundInProgress = false;
    this.turnOrder = [];
    this.turnIndexInRound = 0;
    this.history = [];
  }
}
