import { UnitController } from '../ai/UnitController';
import type { GameAction } from '../types';
import { DataManager } from '../utils/DataManager';
import type { ActionWithEffects, ActionsData, EffectDefinition, EffectValue } from '../utils/DataManager';

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
    const selectedAction = availableActions[randomIndex] || this.getDefaultAction();

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
      ...this.processActionPayload(selectedAction.payload || {}, targetUnitForPayload, allUnits)
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
   * Processes the action payload and generates any random values based on ranges
   */
  private processActionPayload(actionPayload: any, targetUnit?: any, _allUnits?: any[]): any {
    const processedPayload = { ...actionPayload };

    for (const [key, value] of Object.entries(processedPayload)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        (value as any).hasOwnProperty('type') &&
        (value as any).type === 'random'
      ) {
        // This is a random value definition - generate value based on min/max
        const randomDef = value as { type: 'random'; min: number; max: number };
        processedPayload[key] = this.getRandomValue(randomDef.min, randomDef.max);
      } else if (
        typeof value === 'object' &&
        value !== null &&
        (value as any).hasOwnProperty('type') &&
        (value as any).type === 'random_direction'
      ) {
        // This is a direction selector
        processedPayload[key] = this.getRandomDirection();
      } else if (
        typeof value === 'object' &&
        value !== null &&
        (value as any).hasOwnProperty('type') &&
        (value as any).type === 'random_resource'
      ) {
        // This is a resource selector
        processedPayload[key] = this.getRandomResource();
      } else if (
        typeof value === 'object' &&
        value !== null &&
        (value as any).hasOwnProperty('type') &&
        (value as any).type === 'calculated'
      ) {
        // This could be a calculated value based on unit properties
        // For now we'll handle simple cases
        const calcDef = value as { type: 'calculated'; base: string; modifier: number };
        if (targetUnit && calcDef.base) {
          const baseValue = targetUnit.getPropertyValue(calcDef.base);
          processedPayload[key] = Math.max(0, baseValue + (calcDef.modifier || 0));
        } else {
          processedPayload[key] = calcDef.modifier || 0;
        }
      }
    }

    return processedPayload;
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
   * Returns a default action template (legacy method kept for compatibility)
   */
  private getDefaultAction(): any {  // Using any for compatibility until full conversion
    return {
      type: 'idle',
      description: '{{unitName}} the {{unitType}} waits for instructions.',
      effect: 'no effect',
      effects: [{
        target: 'self',
        property: 'time',
        operation: 'add',
        value: { type: 'static', value: 1 },
        permanent: false
      }]
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
   * Uses JSON-defined effects instead of hardcoded switch
   */
  public async executeActionEffect(action: GameAction, units: any[]): Promise<void> {
    // Find the action definition from JSON data to get effect definitions
    const actionDef = this.findActionDefinition(action.type);

    let effectsToExecute: EffectDefinition[] = [];

    if (actionDef && Array.isArray(actionDef.effects)) {
      // Use effects from action definition
      effectsToExecute = actionDef.effects;
    } else if (action.payload.effects && Array.isArray(action.payload.effects)) {
      // If no action def found, try to use effects from action payload
      effectsToExecute = action.payload.effects;
      console.log(`Using effects from payload for action type: ${action.type}`);
    } else {
      console.log(`No effects found for action type: ${action.type}, skipping effects execution`);
      return;
    }

    // Execute each effect
    for (const effect of effectsToExecute) {
      await this.executeSingleEffect(effect, action, units);
    }

    // After executing all effects, check for dead units and handle death
    this.checkForDeadUnits(units);
  }

  /**
   * Checks units for deaths and updates their status
   */
  private checkForDeadUnits(units: any[]): void {
    for (const unit of units) {
      const health = unit.getPropertyValue('health') || 0;
      const currentStatus = unit.getPropertyValue('status') || 'alive';

      // If health drops to 0 or below and unit is currently alive, mark as dead
      if (health <= 0 && currentStatus === 'alive') {
        unit.setProperty('status', 'dead');
        console.log(`${unit.name} has died!`);
      }
      // If health recovers above 0 and unit was dead, mark as alive (for resurrection)
      else if (health > 0 && currentStatus === 'dead') {
        unit.setProperty('status', 'alive');
        console.log(`${unit.name} has been revived!`);
      }
    }
  }

  /**
   * Finds an action definition by type from the loaded JSON data
   */
  private findActionDefinition(actionType: string): ActionWithEffects | undefined {
    // Search through all action categories
    const allCategories = [
      ...this.actionsData.actions.low_health,
      ...this.actionsData.actions.healthy,
      ...this.actionsData.actions.default
    ];

    return allCategories.find(action => action.type === actionType);
  }

  /**
   * Executes a single effect on the appropriate unit(s)
   */
  private async executeSingleEffect(effect: EffectDefinition, action: GameAction, units: any[]): Promise<void> {
    // Determine the target unit based on effect.target
    let targetUnit: any;

    switch (effect.target) {
      case 'self':
        // Find the acting unit by player name
        targetUnit = units.find((unit: any) => unit.name === action.player);
        break;

      case 'target':
        // Find the target unit specified in the action payload
        if (action.payload?.targetUnit) {
          targetUnit = units.find((unit: any) => unit.id === action.payload.targetUnit);
        }
        break;

      case 'all':
        // Apply to all units
        for (const unit of units) {
          await this.applyEffectToUnit(effect, unit, action, units);
        }
        return; // Already applied to all, so return early

      case 'ally':
        // Apply to allied units (for now, just acting unit and target unit if they exist)
        const actingUnit = units.find((unit: any) => unit.name === action.player);
        if (actingUnit) {
          await this.applyEffectToUnit(effect, actingUnit, action, units);
        }
        if (action.payload?.targetUnit) {
          const target = units.find((unit: any) => unit.id === action.payload.targetUnit);
          if (target) {
            await this.applyEffectToUnit(effect, target, action, units);
          }
        }
        return;

      case 'enemy':
        // Apply to enemy units (opposite of target unit)
        if (action.payload?.targetUnit) {
          targetUnit = units.find((unit: any) => unit.id === action.payload.targetUnit);
        } else {
          // If no specific target, pick a different unit than the acting unit
          const actingUnit = units.find((unit: any) => unit.name === action.player);
          targetUnit = units.find((unit: any) => unit.id !== actingUnit?.id);
        }
        break;

      default:
        // Default to self
        targetUnit = units.find((unit: any) => unit.name === action.player);
    }

    if (!targetUnit) {
      console.error(`Could not find target unit for action ${action.type} with target: ${effect.target}`);
      return;
    }

    // Apply the effect to the target unit
    await this.applyEffectToUnit(effect, targetUnit, action, units);
  }

  /**
   * Applies a single effect to a specific unit
   */
  private async applyEffectToUnit(effect: EffectDefinition, targetUnit: any, action: GameAction, allUnits: any[]): Promise<void> {
    // Calculate the value to apply based on the effect's value definition
    const valueToApply = this.calculateEffectValue(effect.value, action, targetUnit, allUnits);

    // Apply the effect based on whether it's permanent or temporary
    if (effect.permanent) {
      // Use setBaseProperty for permanent changes
      targetUnit.setBaseProperty(effect.property, valueToApply);
    } else {
      // Use setProperty for temporary changes
      const currentValue = targetUnit.getPropertyValue(effect.property) || 0;
      let newValue: number;

      switch (effect.operation) {
        case 'add':
          newValue = currentValue + valueToApply;
          break;
        case 'subtract':
          newValue = Math.max(0, currentValue - valueToApply); // Prevent negative values
          break;
        case 'multiply':
          newValue = Math.round(currentValue * valueToApply);
          break;
        case 'divide':
          newValue = Math.round(currentValue / valueToApply);
          break;
        case 'set':
          newValue = valueToApply;
          break;
        default:
          newValue = currentValue + valueToApply; // Default to add if operation is unrecognized
      }

      // Ensure health doesn't exceed maximum (if it's a health property)
      if (effect.property === 'health') {
        newValue = Math.min(100, Math.max(0, newValue));
      } else if (effect.property === 'mana') {
        newValue = Math.min(100, Math.max(0, newValue));
      } else {
        newValue = Math.max(0, newValue);
      }

      targetUnit.setProperty(effect.property, newValue);
    }
  }

  /**
   * Calculates the value to apply based on the effect value definition
   */
  private calculateEffectValue(valueDef: EffectValue, action: GameAction, targetUnit: any, _allUnits: any[]): number {
    switch (valueDef.type) {
      case 'static':
        return valueDef.value ?? 0;
      case 'calculation':
        // For now, just return value or default if calculation is complex
        return valueDef.value ?? 0;
      case 'variable':
        // Return value from action payload or unit properties based on the variable name
        if (valueDef.variable) {
          if (action.payload && action.payload[valueDef.variable] !== undefined) {
            const payloadValue = action.payload[valueDef.variable];
            // If payload value is a random range definition, generate the value
            if (
              typeof payloadValue === 'object' &&
              payloadValue !== null &&
              payloadValue.type === 'random'
            ) {
              const randomDef = payloadValue as { type: 'random'; min: number; max: number };
              return this.getRandomValue(randomDef.min, randomDef.max);
            }
            // Otherwise return the payload value directly
            return payloadValue;
          }
          // If not in payload, could check unit properties
          return targetUnit.getPropertyValue(valueDef.variable) ?? 0;
        }
        return 0;
      case 'random':
        // Generate random value based on min/max in the definition
        if (valueDef.min !== undefined && valueDef.max !== undefined) {
          return this.getRandomValue(valueDef.min, valueDef.max);
        }
        return 0;
      default:
        return valueDef.value ?? 0;
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