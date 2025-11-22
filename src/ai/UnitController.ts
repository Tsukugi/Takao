// Import types from the Atago library
import { BaseUnit } from '@atsu/atago';
import { DataManager } from '../utils/DataManager';
import { randomUUID } from 'crypto';

/**
 * Represents the Unit controller that connects to the Atago library
 * to manage game units and their properties
 */
export class UnitController {
  private gameState: any;
  private initialized: boolean = false;
  private gameUnits: BaseUnit[] = [];
  private namesCatalog: string[];

  /**
   * Initializes the Unit controller with the game state
   */
  public async initialize(gameState: any): Promise<void> {
    this.gameState = gameState;
    this.namesCatalog = DataManager.loadNames();
    this.initialized = true;
    console.log('Unit Controller initialized');

    // Initialize game units using the Atago library
    this.initializeGameUnits();

    console.log('Connected to Atago library');
  }

  /**
   * Initialize game units using the Atago library
   * Tries to load from saved state first, creates new units if no saved state exists
   */
  private initializeGameUnits(): void {
    // Attempt to load existing units from file
    const savedUnits = DataManager.loadUnits();

    if (savedUnits && savedUnits.length > 0) {
      // Load existing units from saved state
      for (const unitData of savedUnits) {
        const unit = new BaseUnit(
          unitData.id,
          unitData.name,
          unitData.type,
          unitData.properties
        );
        this.gameUnits.push(unit);
      }
      console.log(
        `Loaded ${this.gameUnits.length} game units from saved state`
      );
    } else {
      // Create new example units using Atago's BaseUnit class with names from the catalog
      const warriorName = this.getRandomName();
      const unit1 = new BaseUnit(randomUUID(), warriorName, 'warrior', {
        health: { name: 'health', value: 100, baseValue: 100 },
        mana: { name: 'mana', value: 50, baseValue: 50 },
        attack: { name: 'attack', value: 20, baseValue: 20 },
        defense: { name: 'defense', value: 15, baseValue: 15 },
      });

      const archerName = this.getRandomName();
      const unit2 = new BaseUnit(randomUUID(), archerName, 'archer', {
        health: { name: 'health', value: 70, baseValue: 70 },
        mana: { name: 'mana', value: 30, baseValue: 30 },
        attack: { name: 'attack', value: 25, baseValue: 25 },
        defense: { name: 'defense', value: 10, baseValue: 10 },
      });

      this.gameUnits.push(unit1, unit2);
      console.log(
        `Initialized ${this.gameUnits.length} new game units with Atago library`
      );
    }
  }

  /**
   * Gets a random name from the catalog
   */
  private getRandomName(): string {
    if (!this.namesCatalog || this.namesCatalog.length === 0) {
      return 'Unknown'; // fallback if no names are available
    }

    const randomIndex = Math.floor(Math.random() * this.namesCatalog.length);
    return this.namesCatalog[randomIndex];
  }

  /**
   * Gets the current state of the game units
   */
  public async getUnitState(): Promise<BaseUnit[]> {
    if (!this.initialized) {
      throw new Error('Unit Controller not initialized');
    }

    // Return the current state of all game units
    return [...this.gameUnits];
  }

  /**
   * Updates the game state that the unit controller is aware of
   */
  public async updateGameState(newState: any): Promise<void> {
    this.gameState = { ...this.gameState, ...newState };

    // In a real implementation, we would update the Atago units with new information
    console.log('Game state updated for units');
  }

  /**
   * Gets whether the unit controller is initialized
   */
  public getInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Gets the game units managed by this controller
   */
  public getUnits(): BaseUnit[] {
    return [...this.gameUnits];
  }
}
