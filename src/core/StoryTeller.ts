import { UnitController } from '../ai/UnitController';
import type { Action, ExecutedAction, ActionsData, DiaryEntry } from '../types';
import { DataManager } from '../utils/DataManager';
import { StatTracker } from '../utils/StatTracker';
import { ActionProcessor } from '../utils/ActionProcessor';
import { MathUtils } from '../utils/Math';
import { ConditionParser } from '../utils/ConditionParser';
import { BaseUnit } from '@atsu/atago';
import { isComparison } from '../types/typeGuards';

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
      return ActionProcessor.getDefaultExecutedAction(
        new BaseUnit('default-unit', 'DefaultUnit', 'unknown', {}),
        turn
      );
    }

    // Choose a random unit to center the story around
    const randomUnit = MathUtils.getRandomFromArray(units);

    // Get properties of the unit to create a meaningful story
    const unitName = randomUnit.name;
    const unitType = randomUnit.type;

    // Create a story action based on unit properties using JSON data
    let description = '';

    // Get available actions based on unit requirements only
    let availableActions: Action[] = [];

    // Filter actions based on unit requirements (health, mana, etc.)
    for (const action of this.actionsData) {
      // Check all requirements
      if (action.requirements) {
        let meetsAllRequirements = true;
        for (const requirement of action.requirements) {
          if (isComparison(requirement)) {
            // Check property comparison requirement
            const unitValue = randomUnit.getPropertyValue(requirement.property);
            const conditionString = `${requirement.property} ${requirement.operator} ${requirement.value}`;
            if (
              !ConditionParser.evaluateCondition(conditionString, unitValue)
            ) {
              meetsAllRequirements = false;
              break;
            }
          }
        }
        if (!meetsAllRequirements) continue;
      }

      // Add action to available list
      availableActions.push(action);
    }

    // If no actions are available based on requirements, use all actions
    if (availableActions.length === 0) {
      availableActions = [...this.actionsData];
    }

    // Select a random action from available actions
    const selectedAction = MathUtils.getRandomFromArray(availableActions);

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
