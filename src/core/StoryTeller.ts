import { UnitController } from '../ai/UnitController';
import type { Action, ExecutedAction, ActionsData, DiaryEntry } from '../types';
import { DataManager } from '../utils/DataManager';
import { StatTracker } from '../utils/StatTracker';
import { ActionProcessor } from '../utils/ActionProcessor';
import { MathUtils } from '../utils/Math';
import { BaseUnit } from '@atsu/atago';

/**
 * Represents the StoryTeller that generates narrative actions based on unit states
 */
export class StoryTeller {
  private unitController: UnitController;
  private actionsData: ActionsData;
  private storyHistory: string[] = [];
  private diary: DiaryEntry[] = [];

  constructor(unitController: UnitController) {
    this.unitController = unitController;
    this.actionsData = DataManager.loadActions();
    this.diary = DataManager.loadDiary(); // Load existing diary entries
    DataManager.ensureDataDirectory(); // Ensure data directory exists
  }

  /**
   * Generates a story action based on the current unit states
   */
  public async generateStoryAction(turn: number): Promise<ExecutedAction> {
    // Get the current state of units from the UnitController
    const units = await this.unitController.getUnitState();

    // Generate a story action based on unit states
    const storyAction = this.createStoryBasedOnUnits(units, turn);

    // Take a snapshot of unit properties before action execution
    const initialStates = StatTracker.takeSnapshot(units);

    // Execute action effects using the ActionProcessor
    const result = await ActionProcessor.executeActionEffect(
      storyAction.action,
      units
    );
    if (!result.success) {
      console.error(
        `Failed to execute action effect: ${result.errorMessage || 'Unknown error'}`
      );
      return storyAction; // Return early if execution fails
    }

    // Get stat changes by comparing snapshots
    const changes = StatTracker.compareSnapshots(initialStates, units);

    if (changes.length > 0) {
      // Group changes by unit and format them
      const groupedChanges = StatTracker.groupChangesByUnit(changes);

      console.log(
        `\nStat changes for action: ${storyAction.action.type} by ${storyAction.action.player}`
      );

      for (const [unitId, unitChanges] of groupedChanges) {
        const unit = units.find(u => u.id === unitId);
        if (unit) {
          const formattedChanges = StatTracker.formatStatChanges(unitChanges);
          console.log(
            `  ${unit.name} (${unit.id}): ${formattedChanges.join(', ')}`
          );
        }
      }
    }

    // Add to story history
    this.storyHistory.push(
      `Turn ${turn}: ${this.describeAction(storyAction.action)}`
    );

    // Save the current unit states and diary entry
    this.saveUnits();
    this.saveDiaryEntry(storyAction, turn);

    return storyAction;
  }

  /**
   * Creates a story action based on unit states
   */
  private createStoryBasedOnUnits(
    units: BaseUnit[],
    turn: number
  ): ExecutedAction {
    // If no units exist, create a default action
    if (units.length === 0) {
      // Return a default narrative action instead of throwing
      return {
        turn,
        timestamp: Date.now(),
        action: {
          type: 'idle',
          player: 'narrator',
          description:
            'No units available for action. World continues its quiet existence.',
          payload: {},
        },
      };
    }

    // Choose a random unit to center the story around
    const randomUnit = MathUtils.getRandomFromArray(units);

    // Get properties of the unit to create a meaningful story
    const unitName = randomUnit.name;
    const unitType = randomUnit.type;
    const mana = randomUnit.getPropertyValue('mana');

    // Create a story action based on unit properties using JSON data
    let description = '';

    // Get available actions based on unit status and requirements
    let availableActions: Action[] = [];

    // Combine actions from all categories
    const allActions = [
      ...this.actionsData.actions.low_health,
      ...this.actionsData.actions.healthy,
      ...this.actionsData.actions.default,
    ];

    // Filter actions based on unit requirements (health, mana, etc.)
    for (const action of allActions) {
      // Check if action has a payload, if not, provide empty object
      const payload = action.payload || {};

      // Check mana requirement
      if (
        payload.manaRequirement !== undefined &&
        payload.manaRequirement > mana
      ) {
        continue; // Skip if unit doesn't have enough mana
      }

      // Check required status conditions
      if (payload.requiredStatus) {
        let meetsStatus = true;
        for (const [property, condition] of Object.entries(
          payload.requiredStatus
        )) {
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
        ...this.actionsData.actions.default,
      ];
    }

    // Select a random action from available actions
    const randomIndex = Math.floor(Math.random() * availableActions.length);
    const selectedAction =
      availableActions[randomIndex] ||
      ActionProcessor.getDefaultAction(randomUnit);

    // For interaction-type actions, select another unit to interact with
    let targetUnit = null;
    let targetUnitName = 'another unit';

    if (
      ['interact', 'attack', 'support', 'trade'].includes(
        selectedAction.type
      ) &&
      units.length > 1
    ) {
      // Find a different unit to interact with
      const otherUnits = units.filter(u => u.id !== randomUnit.id);
      if (otherUnits.length > 0) {
        targetUnit = MathUtils.getRandomFromArray(otherUnits);
        targetUnitName = targetUnit.name;
      }
    }

    // Create description by replacing placeholders
    description = selectedAction.description
      .replace('{{unitName}}', unitName)
      .replace('{{unitType}}', unitType)
      .replace('{{targetUnitName}}', targetUnitName);

    // Create action payload based on action type

    return {
      turn,
      timestamp: Date.now(),
      action: {
        ...selectedAction,
        description,
        player: unitName, // Add the unit's name as the player
        payload: selectedAction.payload || {}, // Ensure payload exists
      },
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
  public saveDiaryEntry(executedAction: ExecutedAction, turn: number): void {
    const diaryEntry: DiaryEntry = {
      turn,
      timestamp: new Date().toISOString(),
      action: executedAction.action,
    };

    DataManager.saveDiaryEntry(diaryEntry);
    this.diary.push(diaryEntry);
  }

  /**
   * Gets the diary entries
   */
  public getDiary(): DiaryEntry[] {
    return [...this.diary];
  }

  /**
   * Creates a description of the action
   */
  private describeAction(action: Action): string {
    return (
      action.description ||
      `${action.type} action by ${action.player || 'unknown'}`
    );
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
