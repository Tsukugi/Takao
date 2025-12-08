import type { BaseUnit } from '@atsu/atago';

export type Relationship = 'ally' | 'neutral' | 'hostile';

/**
 * Centralized relationship helper for classifying unit interactions.
 * Factions are the primary signal; explicit relationship maps override when present.
 */
export class RelationshipHelper {
  private static readonly DEFAULT_FACTION = 'neutral';

  /**
   * Returns explicit relationship from a unit's relationship map if available.
   */
  private static getExplicitRelationship(
    actor: BaseUnit,
    target: BaseUnit
  ): Relationship | null {
    const relationships = actor.getPropertyValue('relationships');
    if (
      relationships &&
      typeof relationships === 'object' &&
      target.id in (relationships as Record<string, unknown>)
    ) {
      const value = (relationships as Record<string, unknown>)[target.id];
      if (value === 'ally' || value === 'neutral' || value === 'hostile') {
        return value;
      }
    }
    return null;
  }

  /**
   * Extracts a faction string from a unit, with a neutral default.
   */
  public static getFaction(unit: BaseUnit): string {
    const faction = unit.getPropertyValue('faction');
    if (typeof faction === 'string' && faction.trim().length > 0) {
      return faction;
    }
    return this.DEFAULT_FACTION;
  }

  /**
   * Determines relationship between actor and target.
   * Same unit or same faction => ally. Different non-neutral factions => hostile.
   * Any neutral side => neutral. Explicit relationship map on actor overrides faction logic.
   */
  public static getRelationship(
    actor?: BaseUnit,
    target?: BaseUnit
  ): Relationship {
    if (!actor || !target) return 'neutral';
    if (actor.id === target.id) return 'ally';

    const explicit = this.getExplicitRelationship(actor, target);
    if (explicit) return explicit;

    const actorFaction = this.getFaction(actor);
    const targetFaction = this.getFaction(target);

    if (actorFaction === targetFaction) {
      return 'ally';
    }

    if (
      actorFaction === this.DEFAULT_FACTION ||
      targetFaction === this.DEFAULT_FACTION
    ) {
      return 'neutral';
    }

    return 'hostile';
  }

  public static isAlly(actor?: BaseUnit, target?: BaseUnit): boolean {
    return this.getRelationship(actor, target) === 'ally';
  }

  public static isHostile(actor?: BaseUnit, target?: BaseUnit): boolean {
    return this.getRelationship(actor, target) === 'hostile';
  }

  public static isNeutral(actor?: BaseUnit, target?: BaseUnit): boolean {
    return this.getRelationship(actor, target) === 'neutral';
  }
}
