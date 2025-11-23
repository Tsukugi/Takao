import { UnitController } from '../ai/UnitController';
import type { GameAction } from '../types';
import { DataManager } from '../utils/DataManager';
import type { ActionWithEffects, ActionsData } from '../utils/DataManager';
import { StatTracker } from '../utils/StatTracker';
import { ActionProcessor } from '../utils/ActionProcessor';

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

    // Take a snapshot of unit properties before action execution
    const initialStates = StatTracker.takeSnapshot(units);

    // Execute action effects using the ActionProcessor
    const result = await ActionProcessor.executeActionEffect(storyAction, units, initialStates);
    if (!result.success) {
      console.error(`Failed to execute action effect: ${result.errorMessage || 'Unknown error'}`);
      return storyAction; // Return early if execution fails
    }

    // Get stat changes by comparing snapshots
    const changes = StatTracker.compareSnapshots(initialStates, units);

    if (changes.length > 0) {
      // Group changes by unit and format them
      const groupedChanges = StatTracker.groupChangesByUnit(changes);

      console.log(`\nStat changes for action: ${storyAction.type} by ${storyAction.player}`);

      for (const [unitId, unitChanges] of groupedChanges) {
        const unit = units.find((u: any) => u.id === unitId);
        if (unit) {
          const formattedChanges = StatTracker.formatStatChanges(unitChanges);
          console.log(`  ${unit.name} (${unit.id}): ${formattedChanges.join(', ')}`);
        }
      }
    }

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

    // Get available actions based on unit status and requirements
    let availableActions: ActionWithEffects[] = [];

    // Combine actions from all categories
    const allActions = [
      ...this.actionsData.actions.low_health,
      ...this.actionsData.actions.healthy,
      ...this.actionsData.actions.default
    ];

    // Filter actions based on unit requirements (health, mana, etc.)
    for (const action of allActions) {
      // Check mana requirement
      if (action.manaRequirement !== undefined && action.manaRequirement > mana) {
        continue; // Skip if unit doesn't have enough mana
      }

      // Check required status conditions
      if (action.requiredStatus) {
        let meetsStatus = true;
        for (const [property, condition] of Object.entries(action.requiredStatus)) {
          const unitValue = randomUnit?.getPropertyValue(property);

          // Evaluate condition (e.g., "health <= 30")
          if (typeof condition === 'string' && unitValue !== undefined) {
            if (condition.includes('<=')) {
              const parts = condition.split('<=')[1];
              if (parts) {
                const threshold = parseFloat(parts.trim());
                if (isNaN(threshold) || unitValue > threshold) {
                  meetsStatus = false;
                  break;
                }
              }
            } else if (condition.includes('>=')) {
              const parts = condition.split('>=')[1];
              if (parts) {
                const threshold = parseFloat(parts.trim());
                if (isNaN(threshold) || unitValue < threshold) {
                  meetsStatus = false;
                  break;
                }
              }
            } else if (condition.includes('<')) {
              const parts = condition.split('<')[1];
              if (parts) {
                const threshold = parseFloat(parts.trim());
                if (isNaN(threshold) || unitValue >= threshold) {
                  meetsStatus = false;
                  break;
                }
              }
            } else if (condition.includes('>')) {
              const parts = condition.split('>')[1];
              if (parts) {
                const threshold = parseFloat(parts.trim());
                if (isNaN(threshold) || unitValue <= threshold) {
                  meetsStatus = false;
                  break;
                }
              }
            }
          }
        }
        if (!meetsStatus) continue;
      }

      // Add action to available list
      availableActions.push(action);
    }

    // Add special actions if applicable (though they might require specific conditions)
    if (this.actionsData.special) {
      // For now, add all special actions, but in a more advanced version,
      // we could have additional filtering logic here
      availableActions = [...availableActions, ...this.actionsData.special];
    }

    // If no actions are available based on requirements, fallback to default actions
    if (availableActions.length === 0) {
      availableActions = [
        ...this.actionsData.actions.low_health,
        ...this.actionsData.actions.healthy,
        ...this.actionsData.actions.default
      ];
    }

    // Select a random action from available actions
    const randomIndex = Math.floor(Math.random() * availableActions.length);
    const selectedAction = availableActions[randomIndex] || ActionProcessor.getDefaultAction();

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
      effects: selectedAction.effects,
      targetUnit: targetUnit ? targetUnit.id : null
    };

    // Process the action payload to handle random value generation
    const targetUnitForPayload = targetUnit || null; // The target unit if available
    const allUnits = this.unitController.getUnits(); // Use sync method to get units

    payload = {
      ...payload,
      ...ActionProcessor.processActionPayload(selectedAction.payload || {}, targetUnitForPayload, allUnits)
    };

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