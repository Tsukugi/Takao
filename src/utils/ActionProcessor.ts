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
import { Logger } from './Logger';
import { UnitPosition } from './UnitPosition';
import { RelationshipHelper } from './RelationshipHelper';
import { World } from '@atsu/choukai';

/**
 * Utility class for processing action effects
 */
export class ActionProcessor {
  private logger: Logger | undefined;
  private world: World | null = null;

  constructor(logger?: Logger, world?: World) {
    this.logger = logger;
    if (world) {
      this.world = world;
    }
  }

  /**
   * Sets the world for range validation
   */
  public setWorld(world: World): void {
    this.world = world;
  }

  /**
   * Validates that target units are within range for the action
   */
  private validateActionRange(
    action: Action,
    units: BaseUnit[]
  ): { isValid: boolean; errorMessage?: string } {
    try {
      if (!this.world) {
        return { isValid: true }; // If no world is set, skip range validation
      }

      // Get the acting unit
      const actingUnit =
        units?.find?.(unit => unit?.id === action?.player) ||
        units?.find?.(unit => unit?.name === action?.player);
      if (!actingUnit) {
        return { isValid: true }; // If no acting unit found, skip validation
      }

      // Check if action has a target unit in the payload
      const targetUnitId = action?.payload?.targetUnit;
      if (targetUnitId && typeof targetUnitId === 'string') {
        // Find the target unit
        const targetUnit = units?.find?.(unit => unit?.id === targetUnitId);
        if (!targetUnit) {
          return {
            isValid: false,
            errorMessage: `Target unit ${targetUnitId} not found`,
          };
        }

        const maxRange = this.getActionRange(action);

        // Calculate distance between units
        const distance = UnitPosition.getDistanceBetweenUnits(
          units,
          actingUnit.id,
          targetUnitId,
          true // Use Manhattan distance
        );

        // If distance is infinity, units are on different maps
        if (distance === Infinity) {
          return {
            isValid: false,
            errorMessage: `Units ${actingUnit.id} and ${targetUnitId} are on different maps`,
          };
        }

        // Check if the target is within range
        if (distance > maxRange) {
          return {
            isValid: false,
            errorMessage: `Target unit ${targetUnitId} is out of range. Distance: ${distance}, Max range: ${maxRange}`,
          };
        }
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        errorMessage: `Range validation error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Executes the effect of an action on the relevant units (instance method with logger)
   */
  public async executeActionEffect(
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
        this.logger?.info(
          `Using effects from payload for action type: ${action.type}`
        );
      } else {
        // If no effects found in either place, just log and return
        this.logger?.info(
          `No effects found for action type: ${action.type}, skipping effects execution`
        );
        return { success: true };
      }

      // Check if the action has range requirements and validate them
      if (this.world) {
        const rangeValidationResult = this.validateActionRange(action, units);
        if (
          !rangeValidationResult.isValid &&
          rangeValidationResult.errorMessage
        ) {
          this.logger?.error(
            `Range validation failed for action ${action.type}: ${rangeValidationResult.errorMessage}`
          );
          return {
            success: false,
            errorMessage: rangeValidationResult.errorMessage,
          };
        } else if (!rangeValidationResult.isValid) {
          // If validation failed but no specific error message, return a generic failure
          this.logger?.error(
            `Range validation failed for action ${action.type}`
          );
          return {
            success: false,
            errorMessage: `Range validation failed for action ${action.type}`,
          };
        }
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
  private async executeSingleEffect(
    effect: EffectDefinition,
    action: Action,
    units: BaseUnit[]
  ): Promise<void> {
    const actingUnit =
      units.find(unit => unit.id === action.player) ||
      units.find(unit => unit.name === action.player);

    // Determine the target unit based on effect.target
    let targetUnit;

    switch (effect.target) {
      case 'self':
        targetUnit = actingUnit;
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
          if (this.canAffectTarget(effect, actingUnit, unit)) {
            await this.applyEffectToUnit(effect, unit, action);
          } else {
            this.logger?.info(
              `Skipped applying effect ${effect.property} to ${unit.name} due to relationship filter`
            );
          }
        }
        return; // Already applied to all, so return early

      case 'ally': {
        // Apply to allied units - apply to self and target if exists
        if (
          actingUnit &&
          this.canAffectTarget(effect, actingUnit, actingUnit)
        ) {
          await this.applyEffectToUnit(effect, actingUnit, action);
        }
        if (action.payload?.targetUnit) {
          const target = units.find(
            unit => unit.id === action.payload?.targetUnit
          );
          if (target && this.canAffectTarget(effect, actingUnit, target)) {
            await this.applyEffectToUnit(effect, target, action);
          }
        }
        return;
      }

      case 'enemy':
        // Apply to enemy units - apply to target unit
        if (action.payload?.targetUnit) {
          const candidate = units.find(
            unit => unit.id === action.payload?.targetUnit
          );
          if (
            candidate &&
            RelationshipHelper.isHostile(actingUnit, candidate)
          ) {
            targetUnit = candidate;
          }
        } else {
          // If no specific target, pick a different unit than the acting unit
          targetUnit = units.find(
            unit =>
              unit.id !== actingUnit?.id &&
              RelationshipHelper.isHostile(actingUnit, unit)
          );
        }
        break;

      case 'world':
        // Handle new unit creation - add to newUnitsList for processing by StoryTeller
        if (effect.operation === 'create' && effect.property === 'unit') {
          let newUnitType = 'warrior'; // default type

          if (effect.value.type === 'variable' && effect.value.variable) {
            const variableValue = action.payload?.[effect.value.variable];
            if (variableValue && typeof variableValue === 'string') {
              newUnitType = variableValue;
            }
          } else if (effect.value.type === 'static' && effect.value.value) {
            newUnitType = effect.value.value.toString();
          }

          this.logger?.info(
            `New unit of type ${newUnitType} should be added to the game!`
          );
        } else {
          this.logger?.error(
            `Invalid operation for 'world' target in action ${action.type}`
          );
        }
        return; // Return early since we're handling new unit creation

      default:
        // Default to self
        targetUnit = actingUnit;
    }

    if (!targetUnit) {
      this.logger?.error(
        `Could not find target unit for action ${action.type} with target: ${effect.target}`
      );
      return;
    }

    if (!this.canAffectTarget(effect, actingUnit, targetUnit)) {
      this.logger?.info(
        `Skipped applying effect ${effect.property} to ${targetUnit.name} due to relationship filter`
      );
      return;
    }

    // Apply the effect to the target unit
    await this.applyEffectToUnit(effect, targetUnit, action);
  }

  /**
   * Applies a single effect to a specific unit
   */
  private async applyEffectToUnit(
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

    // Ensure the property exists; if missing, initialize it with value 1
    const existingValue = targetUnit.getPropertyValue(effect.property);
    if (existingValue === undefined) {
      targetUnit.setProperty(effect.property, 1);
    }
    const currentValue = isNumber(existingValue) ? existingValue : 1;
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

    if (effect.property === 'health' && newValue <= 0) {
      targetUnit.setProperty('status', 'dead');
    }
  }

  /**
   * Calculates the value to apply based on the effect value definition
   */
  private calculateEffectValue(
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
            return ActionProcessor.getRandomValue(
              payloadValue.min,
              payloadValue.max
            );

          // Otherwise return the payload value directly
          if (isNumber(payloadValue)) return payloadValue;

          // If not in payload, could check unit properties
          return targetUnit.getPropertyValue(valueDef.variable) ?? 0;
        }
        return 0;
      case 'random':
        // Generate random value based on min/max in the definition
        if (valueDef.min !== undefined && valueDef.max !== undefined) {
          return ActionProcessor.getRandomValue(valueDef.min, valueDef.max);
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
   * Relationship-aware gating for effect application.
   * Damage effects must hit hostiles; healing/support effects should only touch allies/self.
   */
  private canAffectTarget(
    effect: EffectDefinition,
    actingUnit: BaseUnit | undefined,
    targetUnit: BaseUnit
  ): boolean {
    if (!actingUnit) return true; // No actor context, allow by default

    const relationship = RelationshipHelper.getRelationship(
      actingUnit,
      targetUnit
    );

    if (ActionProcessor.isDamageEffect(effect)) {
      return relationship === 'hostile';
    }

    if (ActionProcessor.isHealingEffect(effect)) {
      return relationship === 'ally';
    }

    if (effect.target === 'ally') {
      return relationship === 'ally';
    }

    if (effect.target === 'enemy') {
      return relationship === 'hostile';
    }

    return true;
  }

  private static isDamageEffect(effect: EffectDefinition): boolean {
    return effect.property === 'health' && effect.operation === 'subtract';
  }

  private static isHealingEffect(effect: EffectDefinition): boolean {
    return effect.property === 'health' && effect.operation === 'add';
  }

  /**
   * Determine action range from definition, payload, or defaults
   */
  public getActionRange(action: Action): number {
    if (
      action?.payload?.range !== undefined &&
      isNumber(action?.payload?.range)
    ) {
      return action.payload.range;
    }

    return 1;
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
   * Returns a default action template (instance method)
   */
  public getDefaultAction(unit: BaseUnit): Action {
    return {
      player: unit.id,
      type: 'idle',
      description: `${unit.name} idles, doing nothing of note.`,
      payload: { target: 'self' },
      effects: [],
    };
  }

  /**
   * Returns a default executed action (instance method)
   */
  public getDefaultExecutedAction(
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
