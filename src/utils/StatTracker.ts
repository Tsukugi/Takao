import type { BaseUnit, IPropertyCollection } from '@atsu/atago';
import type { StatChange } from '../types';
import { isUnitPosition } from '../types/typeGuards';

/**
 * Utility class for tracking and comparing unit stats
 */
export class StatTracker {
  /**
   * Takes a snapshot of units' properties
   */
  public static takeSnapshot(units: BaseUnit[]): {
    [unitId: string]: IPropertyCollection;
  } {
    const snapshot: Record<string, IPropertyCollection> = {};

    for (const unit of units) {
      // Deep copy the properties to capture the state
      if (unit.properties) {
        snapshot[unit.id] = JSON.parse(JSON.stringify(unit.properties));
      }
    }

    return snapshot;
  }

  /**
   * Compares unit snapshots and finds stat changes
   */
  public static compareSnapshots(
    initialStates: Record<string, IPropertyCollection>,
    units: BaseUnit[]
  ): StatChange[] {
    const changes: StatChange[] = [];
    const ignoredProperties = new Set(['lastActionTurn']);

    for (const unit of units) {
      const initialProperties = initialStates[unit.id];
      if (!initialProperties) continue; // Skip if this unit wasn't in the initial state

      // Get all property names from both initial and current states to ensure we don't miss any
      const allPropNames = new Set([
        ...Object.keys(initialProperties),
        ...Object.keys(unit.properties),
      ]);

      for (const propName of allPropNames) {
        const initialPropInfo = initialProperties[propName];
        const currentPropInfo = unit.properties[propName];

        if (initialPropInfo === undefined || currentPropInfo === undefined) {
          continue; // Skip if property doesn't exist in either state
        }

        if (ignoredProperties.has(propName)) continue;

        // Only log if values are defined and different
        if (
          !StatTracker.valuesEqual(initialPropInfo.value, currentPropInfo.value)
        ) {
          changes.push({
            unitId: unit.id,
            unitName: unit.name,
            propertyName: propName,
            oldValue: initialPropInfo.value,
            newValue: currentPropInfo.value,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Formats stat changes as human-readable strings
   */
  public static formatStatChanges(changes: StatChange[]): string[] {
    const formattedChanges: string[] = [];

    for (const change of changes) {
      const formattedOldValue = StatTracker.formatValue(change.oldValue);
      const formattedNewValue = StatTracker.formatValue(change.newValue);
      formattedChanges.push(
        `${change.propertyName}: ${formattedOldValue} -> ${formattedNewValue}`
      );
    }

    return formattedChanges;
  }

  /**
   * Formats a value for display, handling special cases like positions
   */
  private static formatValue(value: unknown): string {
    if (isUnitPosition(value))
      return `${value.mapId} (${value.position.x}, ${value.position.y})`;

    if (typeof value === 'object') return JSON.stringify(value);

    return String(value);
  }

  /**
   * Groups stat changes by unit
   */
  public static groupChangesByUnit(
    changes: StatChange[]
  ): Map<string, StatChange[]> {
    const grouped = new Map<string, StatChange[]>();

    for (const change of changes) {
      if (!grouped.has(change.unitId)) {
        grouped.set(change.unitId, []);
      }

      grouped.get(change.unitId)!.push(change);
    }

    return grouped;
  }

  /**
   * Deep-ish comparison for primitive/object values used in stat tracking.
   */
  private static valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;

    // Compare unit positions and other objects structurally
    if (
      typeof a === 'object' &&
      typeof b === 'object' &&
      a !== null &&
      b !== null
    ) {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    return false;
  }
}
