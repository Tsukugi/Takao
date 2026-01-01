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
import { isNumber } from '../types/typeGuards';
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
      if (!this.world) return { isValid: true };

      const actingUnit =
        units?.find?.(unit => unit?.id === action?.player) ||
        units?.find?.(unit => unit?.name === action?.player);
      if (!actingUnit) return { isValid: true };

      const targetUnitId = action?.payload?.targetUnit;
      if (!targetUnitId || typeof targetUnitId !== 'string') {
        return { isValid: true };
      }

      const targetUnit = units?.find?.(unit => unit?.id === targetUnitId);
      if (!targetUnit) {
        return {
          isValid: false,
          errorMessage: `Target unit ${targetUnitId} not found`,
        };
      }

      const maxRange = this.getActionRange(action);
      const distance = UnitPosition.getDistanceBetweenUnits(
        units,
        actingUnit.id,
        targetUnitId,
        true
      );

      if (distance === Infinity) {
        return {
          isValid: false,
          errorMessage: `Units ${actingUnit.id} and ${targetUnitId} are on different maps`,
        };
      }

      if (distance > maxRange) {
        return {
          isValid: false,
          errorMessage: `Target unit ${targetUnitId} is out of range. Distance: ${distance}, Max range: ${maxRange}`,
        };
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
      const effectsToExecute = this.getEffectsForAction(action);
      if (effectsToExecute.length === 0) {
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
        targetUnit = this.getHostileTarget(action, actingUnit, units);
        break;

      case 'world':
        // Handle new unit creation - add to newUnitsList for processing by StoryTeller
        if (effect.operation === 'create' && effect.property === 'unit') {
          const newUnitType = this.resolveNewUnitType(effect);
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
    const { propertyName, valueToApply } = this.resolveEffectApplication(
      effect,
      action,
      targetUnit
    );

    // Ensure the property exists; if missing, initialize it with value 1
    const existingValue = targetUnit.getPropertyValue(propertyName);
    if (existingValue === undefined) {
      targetUnit.setProperty(propertyName, 1);
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
    if (propertyName === 'health') {
      newValue = Math.min(100, Math.max(0, newValue));
    } else if (propertyName === 'mana') {
      newValue = Math.min(100, Math.max(0, newValue));
    } else {
      newValue = Math.max(0, newValue);
    }

    // Apply the effect based on whether it's permanent or temporary
    if (effect.permanent) {
      targetUnit.setBaseProperty(propertyName, newValue);
    } else {
      targetUnit.setProperty(propertyName, newValue);
    }

    if (propertyName === 'health' && newValue <= 0) {
      targetUnit.setProperty('status', 'dead');
    }
  }

  private resolveEffectApplication(
    effect: EffectDefinition,
    action: Action,
    targetUnit: BaseUnit
  ): { propertyName: string; valueToApply: number } {
    const valueDef = effect.value;
    if (valueDef?.type === 'modifyProperty') {
      const nested = valueDef.value ?? { type: 'static', value: 0 };
      const propertyName = valueDef.key || effect.property;
      const valueToApply = this.calculateEffectValue(
        nested,
        action,
        targetUnit
      );
      return { propertyName, valueToApply };
    }

    return {
      propertyName: effect.property,
      valueToApply: this.calculateEffectValue(effect.value, action, targetUnit),
    };
  }

  private getEffectsForAction(action: Action): EffectDefinition[] {
    const actionDef = DataManager.loadActions().find(
      a => a.type === action.type
    );

    if (actionDef?.effects?.length) {
      return actionDef.effects;
    }

    if (action?.effects && Array.isArray(action.effects)) {
      this.logger?.info(
        `Using effects from payload for action type: ${action.type}`
      );
      return action.effects;
    }

    return [];
  }

  private getHostileTarget(
    action: Action,
    actingUnit: BaseUnit | undefined,
    units: BaseUnit[]
  ): BaseUnit | undefined {
    if (action.payload?.targetUnit) {
      const candidate = units.find(
        unit => unit.id === action.payload?.targetUnit
      );
      if (candidate && RelationshipHelper.isHostile(actingUnit, candidate)) {
        return candidate;
      }
      return undefined;
    }

    return units.find(
      unit =>
        unit.id !== actingUnit?.id &&
        RelationshipHelper.isHostile(actingUnit, unit)
    );
  }

  private resolveNewUnitType(effect: EffectDefinition): string {
    const valueDef = effect.value;
    if (valueDef?.type === 'modifyProperty') {
      return this.resolveUnitTypeValue(valueDef.value) ?? 'warrior';
    }

    if (valueDef?.type === 'static' && valueDef.value !== undefined) {
      return String(valueDef.value);
    }

    return 'warrior';
  }

  private resolveUnitTypeValue(
    raw: EffectValue | number | string | undefined
  ): string | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw === 'string' || typeof raw === 'number') {
      return String(raw);
    }

    if (raw.type === 'random') {
      return ActionProcessor.getRandomValue(
        raw.min ?? 0,
        raw.max ?? 0
      ).toString();
    }

    if (raw.type === 'static' && raw.value !== undefined) {
      return String(raw.value);
    }

    return undefined;
  }

  /**
   * Calculates the value to apply based on the effect value definition
   */
  private calculateEffectValue(
    valueDef: EffectValue | number | string,
    action: Action,
    targetUnit: BaseUnit
  ): number {
    if (typeof valueDef === 'number') {
      return valueDef;
    }
    if (typeof valueDef === 'string') {
      const parsed = parseFloat(valueDef);
      return isNaN(parsed) ? 0 : parsed;
    }

    switch (valueDef.type) {
      case 'static':
        return valueDef.value ?? 0;
      case 'calculation':
        // For now, just return value or default if calculation is complex
        return valueDef.value ?? 0;
      case 'random':
        // Generate random value based on min/max in the definition
        if (valueDef.min !== undefined && valueDef.max !== undefined) {
          return ActionProcessor.getRandomValue(valueDef.min, valueDef.max);
        }
        return 0;
      case 'modifyProperty': {
        const nested = valueDef.value ?? { type: 'static', value: 0 };
        return this.calculateEffectValue(nested, action, targetUnit);
      }
      default:
        return 0;
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
    targetUnit: BaseUnit | null
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
          const base = targetUnit.getPropertyValue<number>(calcDef.base) ?? 0;
          processedPayload[key] = Math.max(0, base + (calcDef.modifier || 0));
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
    turn: number,
    context: Partial<
      Pick<ExecutedAction, 'round' | 'turnInRound' | 'turnOrder'>
    > = {}
  ): ExecutedAction {
    const safeContext: Partial<
      Pick<ExecutedAction, 'round' | 'turnInRound' | 'turnOrder'>
    > = {};

    if (context.round !== undefined) {
      safeContext.round = context.round;
    }

    if (context.turnInRound !== undefined) {
      safeContext.turnInRound = context.turnInRound;
    }

    if (context.turnOrder && context.turnOrder.length > 0) {
      safeContext.turnOrder = [...context.turnOrder];
    }

    return {
      action: this.getDefaultAction(unit),
      turn,
      timestamp: Date.now(),
      actorId: unit.id,
      ...safeContext,
    };
  }
}
