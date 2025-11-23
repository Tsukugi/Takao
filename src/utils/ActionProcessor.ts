import type { BaseUnit } from '@atsu/atago';
import type {
  Action,
  ExecutedAction,
  ActionPayload,
  EffectDefinition,
  EffectValue,
  ActionProcessingResult,
} from '../types';
import { DataManager } from './DataManager';
import { isNumber, isRandomValue } from '../types/typeGuards';

/**
 * Utility class for processing action effects
 */
export class ActionProcessor {
  /**
   * Executes the effect of an action on the relevant units
   */
  public static async executeActionEffect(
    action: Action,
    units: BaseUnit[]
  ): Promise<ActionProcessingResult> {
    try {
      // Load action definitions from DataManager
      const actionsData = DataManager.loadActions();

      // Since actionsData is now a flat array, use it directly
      const allActions = actionsData;

      // Find the specific action definition by type
      const actionDef = allActions.find(a => a.type === action.type);

      let effectsToExecute: EffectDefinition[] = [];

      if (actionDef && Array.isArray(actionDef.effects)) {
        // Use effects from action definition
        effectsToExecute = actionDef.effects;
      } else if (action?.effects && Array.isArray(action.effects)) {
        // If no action def found, try to use effects from action payload
        effectsToExecute = action.effects;
        console.log(
          `Using effects from payload for action type: ${action.type}`
        );
      } else {
        // If no effects found in either place, just log and return
        console.log(
          `No effects found for action type: ${action.type}, skipping effects execution`
        );
        return { success: true };
      }

      // Execute each effect
      for (const effect of effectsToExecute) {
        await this.executeSingleEffect(effect, action, units);
      }

      return { success: true };
    } catch (error) {
      return { success: false, errorMessage: (error as Error).message };
    }
  }

  /**
   * Executes a single effect on the appropriate unit(s)
   */
  private static async executeSingleEffect(
    effect: EffectDefinition,
    action: Action,
    units: BaseUnit[]
  ): Promise<void> {
    // Determine the target unit based on effect.target
    let targetUnit;

    switch (effect.target) {
      case 'self':
        // Find the acting unit by player name
        targetUnit = units.find(unit => unit.name === action.player);
        break;

      case 'target':
      case 'unit': // 'unit' is treated the same as 'target' - the unit specified in payload
        // Find the target unit specified in the action payload
        if (action.payload?.targetUnit) {
          targetUnit = units.find(
            unit => unit.id === action.payload?.targetUnit
          );
        }
        break;

      case 'all':
        // Apply to all units
        for (const unit of units) {
          await this.applyEffectToUnit(effect, unit, action);
        }
        return; // Already applied to all, so return early

      case 'ally': {
        // Apply to allied units - apply to self and target if exists
        const actingUnit = units.find(unit => unit.name === action.player);
        if (actingUnit) {
          await this.applyEffectToUnit(effect, actingUnit, action);
        }
        if (action.payload?.targetUnit) {
          const target = units.find(
            unit => unit.id === action.payload?.targetUnit
          );
          if (target) {
            await this.applyEffectToUnit(effect, target, action);
          }
        }
        return;
      }

      case 'enemy':
        // Apply to enemy units - apply to target unit
        if (action.payload?.targetUnit) {
          targetUnit = units.find(
            unit => unit.id === action.payload?.targetUnit
          );
        } else {
          // If no specific target, pick a different unit than the acting unit
          const actingUnit = units.find(unit => unit.name === action.player);
          targetUnit = units.find(unit => unit.id !== actingUnit?.id);
        }
        break;

      default:
        // Default to self
        targetUnit = units.find(unit => unit.name === action.player);
    }

    if (!targetUnit) {
      console.error(
        `Could not find target unit for action ${action.type} with target: ${effect.target}`
      );
      return;
    }

    // Apply the effect to the target unit
    await this.applyEffectToUnit(effect, targetUnit, action);
  }

  /**
   * Applies a single effect to a specific unit
   */
  private static async applyEffectToUnit(
    effect: EffectDefinition,
    targetUnit: BaseUnit,
    action: Action
  ): Promise<void> {
    // Calculate the value to apply based on the effect's value definition
    const valueToApply = this.calculateEffectValue(
      effect.value,
      action,
      targetUnit
    );

    // Use setProperty for temporary changes - only if method exists
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

    // Apply the effect based on whether it's permanent or temporary
    if (effect.permanent) {
      targetUnit.setBaseProperty(effect.property, newValue);
    } else {
      targetUnit.setProperty(effect.property, newValue);
    }
  }

  /**
   * Calculates the value to apply based on the effect value definition
   */
  private static calculateEffectValue(
    valueDef: EffectValue,
    action: Action,
    targetUnit: BaseUnit
  ): number {
    switch (valueDef.type) {
      case 'static':
        return valueDef.value ?? 0;
      case 'calculation':
        // For now, just return value or default if calculation is complex
        return valueDef.value ?? 0;
      case 'variable':
        // Return value from action payload or unit properties based on the variable name
        if (!valueDef.variable) return 0;
        if (action.payload && action.payload[valueDef.variable] !== undefined) {
          const payloadValue = action.payload[valueDef.variable];
          // If payload value is a random range definition, generate the value
          if (isRandomValue(payloadValue))
            return this.getRandomValue(payloadValue.min, payloadValue.max);

          // Otherwise return the payload value directly
          if (isNumber(payloadValue)) return payloadValue;

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
   * Helper method to get a random value between min and max
   */
  private static getRandomValue(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Processes the action payload and generates any random values based on ranges
   */
  public static processActionPayload(
    actionPayload: ActionPayload,
    targetUnit?: BaseUnit
  ): ActionPayload {
    const processedPayload = { ...actionPayload };

    for (const [key, value] of Object.entries(processedPayload)) {
      // Check if value is an object with a 'type' property
      const valueType =
        typeof value === 'object' && value !== null && 'type' in value
          ? ((value as { type?: string }).type as string | undefined)
          : undefined;

      if (valueType === 'random') {
        // This is a random value definition - generate value based on min/max
        const randomDef = value as { type: 'random'; min: number; max: number };
        processedPayload[key] = this.getRandomValue(
          randomDef.min,
          randomDef.max
        );
      } else if (valueType === 'random_direction') {
        // This is a direction selector
        processedPayload[key] = this.getRandomDirection();
      } else if (valueType === 'random_resource') {
        // This is a resource selector
        processedPayload[key] = this.getRandomResource();
      } else if (valueType === 'calculated') {
        // This could be a calculated value based on unit properties
        // For now we'll handle simple cases
        const calcDef = value as {
          type: 'calculated';
          base: string;
          modifier: number;
        };
        if (targetUnit && calcDef.base) {
          const baseValue = targetUnit.getPropertyValue(calcDef.base);
          processedPayload[key] = Math.max(
            0,
            baseValue + (calcDef.modifier || 0)
          );
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
  private static getRandomDirection(): string {
    const directions = [
      'north',
      'south',
      'east',
      'west',
      'northeast',
      'northwest',
      'southeast',
      'southwest',
    ];
    const randomIndex = Math.floor(Math.random() * directions.length);
    return directions[randomIndex] || 'north'; // fallback to 'north' if undefined
  }

  /**
   * Returns a random resource
   */
  private static getRandomResource(): string {
    const resources = ['gold', 'wood', 'stone', 'food', 'herbs', 'ore'];
    const randomIndex = Math.floor(Math.random() * resources.length);
    return resources[randomIndex] || 'gold'; // fallback to 'gold' if undefined
  }

  /**
   * Returns a default action template
   */
  public static getDefaultAction(unit: BaseUnit): Action {
    return {
      player: unit.name,
      type: 'idle',
      description: `${unit.name} idles, doing nothing of note.`,
      payload: { target: 'self' },
      effects: [],
    };
  }

  public static getDefaultExecutedAction(
    unit: BaseUnit,
    turn: number
  ): ExecutedAction {
    return {
      action: this.getDefaultAction(unit),
      turn,
      timestamp: Date.now(),
    };
  }
}
