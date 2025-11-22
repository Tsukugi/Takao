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
  private namesCatalog: any = {};

  /**
   * Initializes the Unit controller with the game state
   */
  public async initialize(gameState: any): Promise<void> {
    this.gameState = gameState;
    const namesData = DataManager.loadNames();
    this.namesCatalog = namesData.names || namesData;
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
        // Ensure the unit has status property (add if missing for backward compatibility)
        const propertiesWithStatus = {
          ...unitData.properties,
          status: unitData.properties.status || { name: 'status', value: 'alive', baseValue: 'alive' },
          maxHealth: unitData.properties.maxHealth || { name: 'maxHealth', value: unitData.properties.health?.baseValue || 100, baseValue: unitData.properties.health?.baseValue || 100 },
          maxMana: unitData.properties.maxMana || { name: 'maxMana', value: unitData.properties.mana?.baseValue || 50, baseValue: unitData.properties.mana?.baseValue || 50 }
        };

        const unit = new BaseUnit(
          unitData.id,
          unitData.name,
          unitData.type,
          propertiesWithStatus
        );
        this.gameUnits.push(unit);
      }
      console.log(
        `Loaded ${this.gameUnits.length} game units from saved state`
      );
    } else {
      // Create new example units using Atago's BaseUnit class with names from the catalog
      const warriorName = this.getRandomNameByType('warrior');
      const unit1 = new BaseUnit(randomUUID(), warriorName, 'warrior', {
        health: { name: 'health', value: 100, baseValue: 100 },
        mana: { name: 'mana', value: 50, baseValue: 50 },
        attack: { name: 'attack', value: 20, baseValue: 20 },
        defense: { name: 'defense', value: 15, baseValue: 15 },
        status: { name: 'status', value: 'alive', baseValue: 'alive' },  // Add status property
        maxHealth: { name: 'maxHealth', value: 100, baseValue: 100 },
        maxMana: { name: 'maxMana', value: 50, baseValue: 50 }
      });

      const archerName = this.getRandomNameByType('archer');
      const unit2 = new BaseUnit(randomUUID(), archerName, 'archer', {
        health: { name: 'health', value: 70, baseValue: 70 },
        mana: { name: 'mana', value: 30, baseValue: 30 },
        attack: { name: 'attack', value: 25, baseValue: 25 },
        defense: { name: 'defense', value: 10, baseValue: 10 },
        status: { name: 'status', value: 'alive', baseValue: 'alive' },  // Add status property
        maxHealth: { name: 'maxHealth', value: 70, baseValue: 70 },
        maxMana: { name: 'maxMana', value: 30, baseValue: 30 }
      });

      this.gameUnits.push(unit1, unit2);
      console.log(
        `Initialized ${this.gameUnits.length} new game units with Atago library`
      );
    }
  }

  /**
   * Gets a random name from the catalog by unit type
   */
  private getRandomNameByType(unitType: string = 'general'): string {
    if (!this.namesCatalog) {
      return 'Unknown'; // fallback if no names catalog is available
    }

    // Try to get names by unit type first
    let namesArray: string[] = [];

    switch (unitType.toLowerCase()) {
      case 'warrior':
      case 'warriors':
        namesArray = (this.namesCatalog as any).warriors || [];
        break;
      case 'archer':
      case 'archers':
        namesArray = (this.namesCatalog as any).archers || [];
        break;
      case 'mage':
      case 'mages':
        namesArray = (this.namesCatalog as any).mages || [];
        break;
      case 'cleric':
      case 'clerics':
        namesArray = (this.namesCatalog as any).clerics || (this.namesCatalog as any).general || [];
        break;
      default:
        // Try to get names for the specific type, fallback to general names
        namesArray = (this.namesCatalog as any)[unitType] || (this.namesCatalog as any).general || [];
    }

    // If no specific type names found or array is empty, try to find any available names
    if (!namesArray || namesArray.length === 0) {
      // Look for any array in the names catalog as fallback
      const allKeys = Object.keys(this.namesCatalog);
      for (const key of allKeys) {
        if (Array.isArray(this.namesCatalog[key]) && this.namesCatalog[key].length > 0) {
          namesArray = this.namesCatalog[key];
          break;
        }
      }

      // If still no names found, use empty array which will return fallback
      if (!namesArray) {
        namesArray = [];
      }
    }

    if (namesArray.length === 0) {
      return 'Unknown'; // fallback if no names are available
    }

    const randomIndex = Math.floor(Math.random() * namesArray.length);
    return namesArray[randomIndex] || 'Unknown';
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
