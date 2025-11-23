import type { PropertySnapshot, StatChange } from '../types';

/**
 * Utility class for tracking and comparing unit stats
 */
export class StatTracker {
  /**
   * Takes a snapshot of units' properties
   */
  public static takeSnapshot(
    units: { id: string; properties: PropertySnapshot }[]
  ): { [unitId: string]: PropertySnapshot } {
    const snapshot: { [unitId: string]: PropertySnapshot } = {};

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
    initialStates: { [unitId: string]: PropertySnapshot },
    units: { id: string; name: string; properties: PropertySnapshot }[]
  ): StatChange[] {
    const changes: StatChange[] = [];

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

        let initialValue: unknown;
        let newValue: unknown;

        // Extract value from initial property info (could be object with value field or raw value)
        if (
          initialPropInfo &&
          typeof initialPropInfo === 'object' &&
          initialPropInfo !== null &&
          'value' in initialPropInfo
        ) {
          const typedInitialPropInfo = initialPropInfo as { value?: unknown };
          initialValue = typedInitialPropInfo.value;
        } else {
          initialValue = initialPropInfo;
        }

        // Extract value from current property info (could be object with value field or raw value)
        if (
          currentPropInfo &&
          typeof currentPropInfo === 'object' &&
          currentPropInfo !== null &&
          'value' in currentPropInfo
        ) {
          const typedCurrentPropInfo = currentPropInfo as { value?: unknown };
          newValue = typedCurrentPropInfo.value;
        } else {
          newValue = currentPropInfo;
        }

        // Only log if values are defined and different
        if (
          initialValue !== undefined &&
          newValue !== undefined &&
          initialValue !== newValue
        ) {
          changes.push({
            unitId: unit.id,
            unitName: unit.name,
            propertyName: propName,
            oldValue: initialValue,
            newValue: newValue,
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
      formattedChanges.push(
        `${change.propertyName}: ${change.oldValue} -> ${change.newValue}`
      );
    }

    return formattedChanges;
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
}
