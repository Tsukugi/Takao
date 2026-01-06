import { BaseUnit } from '@atsu/atago';
import type { Action, GoalDefinition, GoalsData } from '../../types';
import { DataManager } from '../../utils/DataManager';
import { MathUtils } from '../../utils/Math';
import { RelationshipHelper } from '../../utils/RelationshipHelper';

interface GoalContext {
  availableActions: Action[];
  units?: BaseUnit[];
  turn: number;
}

interface GoalCandidate {
  goal: GoalDefinition;
  score: number;
  reason?: string;
}

interface GoalActionCandidate {
  goal: GoalDefinition;
  score: number;
  reason: string;
  actions: Action[];
}

interface GoalChoice {
  goal: GoalDefinition;
  action: Action | null;
  candidateActions: Action[];
  reason: string;
  goalCandidates: GoalActionCandidate[];
}

/**
 * Simple goal system that scores goals, picks the best, then chooses
 * the first executable action for that goal.
 */
export class GoalSystem {
  private goals: GoalDefinition[];

  constructor(goalsData?: GoalsData) {
    this.goals = goalsData ?? DataManager.loadGoals();
  }

  public chooseAction(unit: BaseUnit, context: GoalContext): GoalChoice {
    const evaluatedGoals = this.evaluateGoals(unit, context).sort(
      (a, b) => b.score - a.score
    );

    const goalCandidates: GoalActionCandidate[] = evaluatedGoals.map(
      candidate => {
        const actionsForGoal = this.getActionsForGoal(
          candidate.goal,
          context.availableActions
        );
        return {
          goal: candidate.goal,
          score: candidate.score,
          reason: candidate.reason ?? 'Fulfilled goal criteria',
          actions: actionsForGoal,
        };
      }
    );

    for (const candidate of goalCandidates) {
      if (candidate.actions.length > 0) {
        const chosenAction = candidate.actions[0] ?? null;
        return {
          goal: candidate.goal,
          action: chosenAction,
          candidateActions: candidate.actions,
          reason: candidate.reason,
          goalCandidates,
        };
      }
    }

    // Fallback: use any available action with the first known goal
    const fallbackAction =
      context.availableActions[0] ??
      MathUtils.getRandomFromArray(context.availableActions) ??
      null;

    const fallbackGoal =
      evaluatedGoals[0]?.goal ?? this.goals[0] ?? this.createDefaultGoal();

    return {
      goal: fallbackGoal,
      action: fallbackAction,
      candidateActions: context.availableActions,
      reason: evaluatedGoals[0]?.reason ?? 'Fallback selection',
      goalCandidates,
    };
  }

  private evaluateGoals(unit: BaseUnit, context: GoalContext): GoalCandidate[] {
    const health = unit.getPropertyValue<number>('health') ?? 0;
    const maxHealth = unit.getPropertyValue<number>('maxHealth') ?? 0;
    const mana = unit.getPropertyValue<number>('mana') ?? 0;
    const maxMana = unit.getPropertyValue<number>('maxMana') ?? 0;
    const healthPct = maxHealth > 0 ? health / maxHealth : 1;
    const manaPct = maxMana > 0 ? mana / maxMana : 1;
    const hostilesAvailable = this.hasHostileTarget(unit, context.units);

    const candidates: GoalCandidate[] = [];

    const recoverHealthGoal = this.findGoalById('RecoverHealth');
    if (recoverHealthGoal) {
      if (healthPct < 0.3) {
        candidates.push({
          goal: recoverHealthGoal,
          score: 100,
          reason: 'Health critically low',
        });
      } else if (healthPct < 0.6) {
        candidates.push({
          goal: recoverHealthGoal,
          score: 75,
          reason: 'Health below comfort threshold',
        });
      }
    }

    const recoverManaGoal = this.findGoalById('RecoverMana');
    if (recoverManaGoal && manaPct < 0.5) {
      const score = manaPct < 0.25 ? 70 : 45;
      candidates.push({
        goal: recoverManaGoal,
        score,
        reason: 'Mana running low',
      });
    }

    const attackGoal = this.findGoalById('AttackEnemy');
    if (attackGoal && hostilesAvailable) {
      const baseAttackScore = healthPct > 0.35 ? 60 : 25;
      candidates.push({
        goal: attackGoal,
        score: baseAttackScore,
        reason: 'Hostile targets available',
      });
    }

    const exploreGoal = this.findGoalById('Explore');
    if (exploreGoal) {
      candidates.push({
        goal: exploreGoal,
        score: 10,
        reason: 'Fallback exploration',
      });
    }

    return candidates;
  }

  private getActionsForGoal(
    goal: GoalDefinition,
    availableActions: Action[]
  ): Action[] {
    if (!goal?.candidateActions || goal.candidateActions.length === 0) {
      return [];
    }

    const actions = goal.candidateActions
      .map(actionType =>
        availableActions.find(action => action.type === actionType)
      )
      .filter((action): action is Action => Boolean(action));

    return actions;
  }

  private findGoalById(goalId: string): GoalDefinition | undefined {
    return this.goals.find(goal => goal.id === goalId);
  }

  private createDefaultGoal(): GoalDefinition {
    return {
      id: 'Default',
      label: 'Default',
      completion: { type: 'none' },
      candidateActions: [],
    };
  }

  /**
   * Determines whether the unit has any hostile targets available.
   */
  private hasHostileTarget(actor: BaseUnit, units?: BaseUnit[]): boolean {
    if (!units || units.length === 0) return true; // Unknown context: allow attack goal
    return units.some(
      other =>
        other.id !== actor.id && RelationshipHelper.isHostile(actor, other)
    );
  }
}
