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

    // Create description by replacing placeholders
    description = selectedAction.description
      .replace('{{unitName}}', unitName || 'Unknown Unit')
      .replace('{{unitType}}', unitType || 'entity');

    // Create action payload based on action type
    let payload: any = {
      description,
      unitType: unitType || 'entity',
      health,
      mana,
      effect: selectedAction.effect
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