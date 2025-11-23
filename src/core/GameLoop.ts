/**
 * Represents the game loop that handles turn-based mechanics
 */
export class GameLoop {
  private intervalId: NodeJS.Timeout | null = null;
  private turn: number = 0;
  private isRunning: boolean = false;
  private turnInterval: number = 1000; // 1 second per turn by default

  /**
   * Starts the game loop with a callback function to be called each turn
   */
  public start(turnCallback: (turn: number) => void): void {
    if (this.isRunning) {
      console.warn('Game loop is already running');
      return;
    }

    this.isRunning = true;
    console.log('Game loop started');

    this.intervalId = setInterval(() => {
      this.turn++;
      turnCallback(this.turn);
    }, this.turnInterval);
  }

  /**
   * Stops the game loop
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('Game loop stopped');
    }
  }

  /**
   * Sets the interval between turns (in milliseconds)
   */
  public setTurnInterval(interval: number): void {
    this.turnInterval = interval;
  }

  /**
   * Gets the interval between turns (in milliseconds)
   */
  public getTurnInterval(): number {
    return this.turnInterval;
  }

  /**
   * Gets whether the game loop is currently running
   */
  public getRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Gets the current turn number
   */
  public getTurn(): number {
    return this.turn;
  }
}
