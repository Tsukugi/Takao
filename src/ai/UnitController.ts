// Import types from the Atago library
import { BaseUnit } from '@atsu/atago';
import { DataManager } from '../utils/DataManager';
import type { GameState, NamesData } from '../types';
import { randomUUID } from 'crypto';

/**
 * Represents the Unit controller that connects to the Atago library
 * to manage game units and their properties
 */
export class UnitController {
  private gameState: GameState | null = null; // TODO: Define proper GameState type
  private initialized: boolean = false;
  private gameUnits: BaseUnit[] = [];
  private namesCatalog: NamesData = {};
  private readonly defaultFaction = 'Neutral';

  /**
   * Initializes the Unit controller with the game state
   */
  public async initialize(gameState: GameState): Promise<void> {
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
        this.ensureFaction(unit);
        this.gameUnits.push(unit);
      }
      console.log(
        `Loaded ${this.gameUnits.length} game units from saved state`
      );
    } else {
      // Create new example units using Atago's BaseUnit class with names from the catalog
      const warriorName = this.getRandomName(true); // Male name for warrior
      const unit1 = new BaseUnit(randomUUID(), warriorName, 'warrior', {
        health: { name: 'health', value: 100, baseValue: 100 },
        mana: { name: 'mana', value: 50, baseValue: 50 },
        attack: { name: 'attack', value: 20, baseValue: 20 },
        defense: { name: 'defense', value: 15, baseValue: 15 },
        status: { name: 'status', value: 'alive', baseValue: 'alive' }, // Add status property
        maxHealth: { name: 'maxHealth', value: 100, baseValue: 100 },
        maxMana: { name: 'maxMana', value: 50, baseValue: 50 },
        faction: {
          name: 'faction',
          value: this.defaultFaction,
          baseValue: this.defaultFaction,
        },
      });

      const archerName = this.getRandomName(false); // Female name for archer
      const unit2 = new BaseUnit(randomUUID(), archerName, 'archer', {
        health: { name: 'health', value: 70, baseValue: 70 },
        mana: { name: 'mana', value: 30, baseValue: 30 },
        attack: { name: 'attack', value: 25, baseValue: 25 },
        defense: { name: 'defense', value: 10, baseValue: 10 },
        status: { name: 'status', value: 'alive', baseValue: 'alive' }, // Add status property
        maxHealth: { name: 'maxHealth', value: 70, baseValue: 70 },
        maxMana: { name: 'maxMana', value: 30, baseValue: 30 },
        faction: {
          name: 'faction',
          value: this.defaultFaction,
          baseValue: this.defaultFaction,
        },
      });

      this.ensureFaction(unit1);
      this.ensureFaction(unit2);
      this.gameUnits.push(unit1, unit2);
      console.log(
        `Initialized ${this.gameUnits.length} new game units with Atago library`
      );
    }
  }

  /**
   * Gets a random name from the catalog by gender
   */
  private getRandomName(isMale: boolean = true): string {
    const unknown = 'Unknown';

    if (!this.namesCatalog) {
      return unknown; // fallback if no names catalog is available
    }

    const namesArray = isMale
      ? this.namesCatalog.male || []
      : this.namesCatalog.female || [];

    if (namesArray.length === 0) {
      return unknown; // fallback if no names are available
    }

    const randomIndex = Math.floor(Math.random() * namesArray.length);
    return namesArray[randomIndex] || unknown;
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
  public async updateGameState(newState: Partial<GameState>): Promise<void> {
    this.gameState = { ...this.gameState, ...newState } as GameState;

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

  /**
   * Adds a new unit to the game
   */
  public async addNewUnit(): Promise<BaseUnit> {
    // Generate a random name for the new unit
    const isMale = Math.random() > 0.5;
    const newUnitName = this.getRandomName(isMale);

    // Generate fully random stats with correlations between them
    // Health ranges from 60-120 depending on other stats
    const baseHealth = Math.floor(Math.random() * 60) + 60; // 60-120

    // Mana ranges from 20-70 depending on other stats
    const baseMana = Math.floor(Math.random() * 50) + 20; // 20-70

    // Attack is base stat with some randomness
    const baseAttack = Math.floor(Math.random() * 25) + 10; // 10-35

    // Defense is correlated to attack (higher attack often means higher defense), with some variation
    const baseDefense = Math.max(
      5,
      Math.floor(baseAttack * (0.4 + Math.random() * 0.4))
    ); // Correlated to attack (±20%)

    // Create the new unit with correlated random stats
    const newUnit = new BaseUnit(randomUUID(), newUnitName, 'adventurer', {
      health: { name: 'health', value: baseHealth, baseValue: baseHealth },
      mana: { name: 'mana', value: baseMana, baseValue: baseMana },
      attack: { name: 'attack', value: baseAttack, baseValue: baseAttack },
      defense: {
        name: 'defense',
        value: baseDefense,
        baseValue: baseDefense,
      },
      status: { name: 'status', value: 'alive', baseValue: 'alive' },
      maxHealth: {
        name: 'maxHealth',
        value: baseHealth,
        baseValue: baseHealth,
      },
      maxMana: { name: 'maxMana', value: baseMana, baseValue: baseMana },
      // Add other properties with reasonable ranges
      resources: {
        name: 'resources',
        value: Math.floor(Math.random() * 15) + 5,
        baseValue: 5,
        modifiers: [],
        readonly: false,
      },

      faction: {
        name: 'faction',
        value: this.defaultFaction,
        baseValue: this.defaultFaction,
      },
    });

    // Add the new unit to the game units array
    this.gameUnits.push(newUnit);
    this.ensureFaction(newUnit);

    console.log(`New unit ${newUnitName} (${newUnit.id}) has joined the game!`);

    // Save the updated units to the data manager
    DataManager.saveUnits(this.gameUnits);

    return newUnit;
  }

  /**
   * Removes a unit from the controller by id.
   */
  public removeUnit(unitId: string): boolean {
    const index = this.gameUnits.findIndex(unit => unit.id === unitId);
    if (index === -1) {
      return false;
    }

    this.gameUnits.splice(index, 1);
    DataManager.saveUnits(this.gameUnits);
    return true;
  }

  /**
   * Ensure a unit has a non-neutral faction so hostilities resolve correctly.
   */
  private ensureFaction(unit: BaseUnit): void {
    const faction = unit.getPropertyValue('faction');
    if (typeof faction === 'string' && faction.trim().length > 0) {
      return;
    }
    unit.setProperty('faction', this.defaultFaction);
  }
}
