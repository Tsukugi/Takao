import { UnitController } from '../ai/UnitController';
import type { GameAction } from '../types';
import { DataManager } from '../utils/DataManager';
import type { ActionTemplate, ActionsData } from '../utils/DataManager';

/**
 * Represents the StoryTeller that generates narrative actions based on unit states
 */
export class StoryTeller {
  private unitController: UnitController;
  private actionsData: ActionsData;
  private storyHistory: string[] = [];
  private diary: any[] = [];

  constructor(unitController: UnitController) {
    this.unitController = unitController;
    this.actionsData = DataManager.loadActions();
    this.diary = DataManager.loadDiary(); // Load existing diary entries
    DataManager.ensureDataDirectory(); // Ensure data directory exists
  }

  /**
   * Generates a story action based on the current unit states
   */
  public async generateStoryAction(turn: number): Promise<GameAction> {
    // Get the current state of units from the UnitController
    const units = await this.unitController.getUnitState();

    // Generate a story action based on unit states
    const storyAction = this.createStoryBasedOnUnits(units, turn);

    // Execute the effect of the action on the units
    await this.executeActionEffect(storyAction, units);

    // Add to story history
    this.storyHistory.push(`Turn ${turn}: ${this.describeAction(storyAction)}`);

    // Save the current unit states and diary entry
    this.saveUnits();
    this.saveDiaryEntry(storyAction, turn);

    return storyAction;
  }

  /**
   * Creates a story action based on unit states
   */
  private createStoryBasedOnUnits(units: any[], turn: number): GameAction {
    // If no units exist, create a default action
    if (units.length === 0) {
      return {
        type: 'idle',
        player: 'narrator',
        payload: { description: 'The world waits in silence...' },
        turn,
        timestamp: Date.now()
      };
    }

    // Choose a random unit to center the story around
    const randomUnit = units[Math.floor(Math.random() * units.length)];

    // Get properties of the unit to create a meaningful story
    const unitName = randomUnit?.name || 'Unknown Unit';
    const unitType = randomUnit?.type || 'entity';
    const health = randomUnit?.getPropertyValue('health') || 100;
    const mana = randomUnit?.getPropertyValue('mana') || 50;

    // Create a story action based on unit properties using JSON data
    let action: GameAction;
    let description = '';

    // Based on health, select action from JSON data
    let selectedAction: ActionTemplate;

    if (health < 30) {
      // Unit is in danger - select from low_health actions
      const lowHealthActions = this.actionsData.actions.low_health;
      const randomIndex = Math.floor(Math.random() * lowHealthActions.length);
      selectedAction = lowHealthActions[randomIndex] || this.getDefaultAction();
    } else if (health > 80 && Math.random() > 0.5) {
      // Unit is healthy and adventurous - select from healthy actions
      const healthyActions = this.actionsData.actions.healthy;
      const randomIndex = Math.floor(Math.random() * healthyActions.length);
      selectedAction = healthyActions[randomIndex] || this.getDefaultAction();
    } else {
      // Default action - select from default actions
      const defaultActions = this.actionsData.actions.default;
      const randomIndex = Math.floor(Math.random() * defaultActions.length);
      selectedAction = defaultActions[randomIndex] || this.getDefaultAction();
    }

    // For interaction-type actions, select another unit to interact with
    let targetUnit = null;
    let targetUnitName = 'another unit';

    if (['interact', 'attack', 'support', 'trade'].includes(selectedAction.type) && units.length > 1) {
      // Find a different unit to interact with
      const otherUnits = units.filter(u => u.id !== randomUnit.id);
      if (otherUnits.length > 0) {
        targetUnit = otherUnits[Math.floor(Math.random() * otherUnits.length)];
        targetUnitName = targetUnit.name || 'another unit';
      }
    }

    // Create description by replacing placeholders
    description = selectedAction.description
      .replace('{{unitName}}', unitName || 'Unknown Unit')
      .replace('{{unitType}}', unitType || 'entity')
      .replace('{{targetUnitName}}', targetUnitName);

    // Create action payload based on action type
    let payload: any = {
      description,
      unitType: unitType || 'entity',
      health,
      mana,
      effect: selectedAction.effect,
      targetUnit: targetUnit ? targetUnit.id : null
    };

    // Add type-specific payload data
    switch (selectedAction.type) {
      case 'explore':
        payload.direction = this.getRandomDirection();
        break;
      case 'search':
        payload.target = 'healing';
        break;
      case 'retreat':
        payload.target = 'safe_location';
        break;
      case 'patrol':
        payload.direction = this.getRandomDirection();
        break;
      case 'gather':
        payload.resource = this.getRandomResource();
        break;
      case 'attack':
        payload.damage = this.getRandomValue(10, 20);
        break;
      case 'support':
        payload.healing = this.getRandomValue(10, 15);
        break;
      case 'interact':
        payload.experienceGain = this.getRandomValue(5, 10);
        break;
      case 'defend':
        payload.defenseBoost = this.getRandomValue(5, 10);
        break;
      case 'train':
        payload.attackBoost = this.getRandomValue(2, 5);
        payload.defenseBoost = this.getRandomValue(1, 3);
        break;
      case 'rest':
        payload.healthRestore = this.getRandomValue(5, 10);
        payload.manaRestore = this.getRandomValue(5, 10);
        break;
      case 'meditate':
        payload.healthRestore = 20;
        payload.manaRestore = 15;
        break;
      case 'hunt':
        payload.resourceGain = this.getRandomValue(5, 15);
        payload.foodGain = this.getRandomValue(3, 8);
        break;
    }

    action = {
      type: selectedAction.type,
      player: unitName || 'Unknown',
      payload,
      turn,
      timestamp: Date.now()
    };

    return action;
  }

  /**
   * Returns a random direction
   */
  private getRandomDirection(): string {
    const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];
    const randomIndex = Math.floor(Math.random() * directions.length);
    return directions[randomIndex] || 'north'; // fallback to 'north' if undefined
  }

  /**
   * Returns a random resource
   */
  private getRandomResource(): string {
    const resources = ['gold', 'wood', 'stone', 'food', 'herbs', 'ore'];
    const randomIndex = Math.floor(Math.random() * resources.length);
    return resources[randomIndex] || 'gold'; // fallback to 'gold' if undefined
  }

  /**
   * Returns a default action template
   */
  private getDefaultAction(): ActionTemplate {
    return {
      type: 'idle',
      description: '{{unitName}} the {{unitType}} waits for instructions.',
      effect: 'no effect'
    };
  }

  /**
   * Helper method to get a random value between min and max
   */
  private getRandomValue(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Executes the effect of an action on the relevant units
   */
  public async executeActionEffect(action: GameAction, units: any[]): Promise<void> {
    const actionType = action.type;
    const actionPayload = action.payload;

    // Find the acting unit by name
    const actingUnit = units.find((unit: any) => unit.name === action.player);
    if (!actingUnit) {
      console.error(`Could not find acting unit with name: ${action.player}`);
      return;
    }

    // Handle different action types and apply effects
    switch (actionType) {
      case 'rest':
        if (actionPayload.healthRestore) {
          const currentHealth = actingUnit.getPropertyValue('health') || 0;
          const newHealth = Math.min(100, currentHealth + actionPayload.healthRestore);
          actingUnit.setProperty('health', newHealth); // This will update value, not baseValue
        }
        if (actionPayload.manaRestore) {
          const currentMana = actingUnit.getPropertyValue('mana') || 0;
          const newMana = Math.min(100, currentMana + actionPayload.manaRestore);
          actingUnit.setProperty('mana', newMana); // This will update value, not baseValue
        }
        break;

      case 'train':
        // Training permanently increases stats (base values should change)
        if (actionPayload.attackBoost) {
          actingUnit.setBaseProperty('attack', actionPayload.attackBoost); // Permanently increases base value
        }
        if (actionPayload.defenseBoost) {
          actingUnit.setBaseProperty('defense', actionPayload.defenseBoost); // Permanently increases base value
        }
        break;

      case 'attack':
        // Find target unit to apply damage
        if (actionPayload.targetUnit) {
          const targetUnit = units.find((unit: any) => unit.id === actionPayload.targetUnit);
          if (targetUnit) {
            const currentHealth = targetUnit.getPropertyValue('health') || 0;
            const newHealth = Math.max(0, currentHealth - actionPayload.damage);
            targetUnit.setProperty('health', newHealth); // This will update value, not baseValue

            // Also reduce attacker's mana
            if (actionPayload.damage) {
              const currentMana = actingUnit.getPropertyValue('mana') || 0;
              const newMana = Math.max(0, currentMana - 5); // 5 mana cost for attack
              actingUnit.setProperty('mana', newMana); // This will update value, not baseValue
            }
          }
        }
        break;

      case 'support':
        // Find target unit to heal
        if (actionPayload.targetUnit) {
          const targetUnit = units.find((unit: any) => unit.id === actionPayload.targetUnit);
          if (targetUnit) {
            const currentHealth = targetUnit.getPropertyValue('health') || 0;
            const newHealth = Math.min(100, currentHealth + actionPayload.healing);
            targetUnit.setProperty('health', newHealth); // This will update value, not baseValue
          }
        }
        break;

      case 'meditate':
        if (actionPayload.healthRestore) {
          const currentHealth = actingUnit.getPropertyValue('health') || 0;
          const newHealth = Math.min(100, currentHealth + actionPayload.healthRestore);
          actingUnit.setProperty('health', newHealth); // This will update value, not baseValue
        }
        if (actionPayload.manaRestore) {
          const currentMana = actingUnit.getPropertyValue('mana') || 0;
          const newMana = Math.min(100, currentMana + actionPayload.manaRestore);
          actingUnit.setProperty('mana', newMana); // This will update value, not baseValue
        }
        break;

      case 'defend':
        if (actionPayload.defenseBoost) {
          const currentDefense = actingUnit.getPropertyValue('defense') || 0;
          const newDefense = currentDefense + actionPayload.defenseBoost;
          actingUnit.setProperty('defense', newDefense); // This will update value, not baseValue
        }
        break;

      case 'interact':
        // Apply experience gain to both units (permanent improvement)
        if (actionPayload.experienceGain && actionPayload.targetUnit) {
          const targetUnit = units.find((unit: any) => unit.id === actionPayload.targetUnit);
          if (targetUnit) {
            // Apply experience gain to both units (permanent improvement)
            const attackIncrease = Math.floor(actionPayload.experienceGain / 2);
            actingUnit.setBaseProperty('attack', attackIncrease); // Permanent improvement
            targetUnit.setBaseProperty('attack', attackIncrease); // Permanent improvement
          }
        }
        break;

      case 'hunt':
        // Add resources to the acting unit (could be handled differently based on game design)
        // For now, we'll just log it
        break;

      // Add more action types as needed
    }
  }

  /**
   * Saves the current unit states to JSON
   */
  public saveUnits(): void {
    const units = this.unitController.getUnits();
    DataManager.saveUnits(units);
  }

  /**
   * Saves a diary entry about the current turn
   */
  public saveDiaryEntry(action: GameAction, turn: number): void {
    const diaryEntry = {
      turn,
      timestamp: new Date().toISOString(),
      action: {
        type: action.type,
        player: action.player,
        description: action.payload.description
      },
      summary: action.payload.description
    };

    DataManager.saveDiaryEntry(diaryEntry);
    this.diary.push(diaryEntry);
  }

  /**
   * Gets the diary entries
   */
  public getDiary(): any[] {
    return [...this.diary];
  }

  /**
   * Creates a description of the action
   */
  private describeAction(action: GameAction): string {
    return action.payload?.description || `${action.type} action by ${action.player || 'unknown'}`;
  }

  /**
   * Gets the story history
   */
  public getStoryHistory(): string[] {
    return [...this.storyHistory];
  }

  /**
   * Gets the latest story entry
   */
  public getLatestStory(): string | undefined {
    if (this.storyHistory.length === 0) {
      return undefined;
    }
    const lastStory = this.storyHistory[this.storyHistory.length - 1];
    return typeof lastStory === 'string' ? lastStory : undefined;
  }
}