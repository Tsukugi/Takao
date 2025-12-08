import { BaseUnit } from '@atsu/atago';
import type { Action, GoalDefinition, GoalsData } from '../../types';
import { DataManager } from '../../utils/DataManager';
import { MathUtils } from '../../utils/Math';

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

interface GoalChoice {
  goal: GoalDefinition;
  action: Action | null;
  candidateActions: Action[];
  reason: string;
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
    const evaluatedGoals = this.evaluateGoals(unit).sort(
      (a, b) => b.score - a.score
    );

    for (const candidate of evaluatedGoals) {
      const actionsForGoal = this.getActionsForGoal(
        candidate.goal,
        context.availableActions
      );
      if (actionsForGoal.length > 0) {
        const chosenAction = actionsForGoal[0] ?? null;
        return {
          goal: candidate.goal,
          action: chosenAction,
          candidateActions: actionsForGoal,
          reason: candidate.reason ?? 'Scored goal',
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
    };
  }

  private evaluateGoals(unit: BaseUnit): GoalCandidate[] {
    const health = this.getNumericProperty(unit, 'health');
    const maxHealth = this.getNumericProperty(unit, 'maxHealth');
    const mana = this.getNumericProperty(unit, 'mana');
    const maxMana = this.getNumericProperty(unit, 'maxMana');
    const healthPct = maxHealth > 0 ? health / maxHealth : 1;
    const manaPct = maxMana > 0 ? mana / maxMana : 1;

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
    if (attackGoal) {
      const baseAttackScore = healthPct > 0.35 ? 60 : 25;
      candidates.push({
        goal: attackGoal,
        score: baseAttackScore,
        reason: 'Default offensive posture',
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

  private getNumericProperty(unit: BaseUnit, propertyName: string): number {
    const propertyValue = unit.getPropertyValue(propertyName);
    if (typeof propertyValue === 'number') {
      return propertyValue;
    }

    if (
      typeof propertyValue === 'object' &&
      propertyValue !== null &&
      'value' in propertyValue &&
      typeof (propertyValue as { value?: unknown }).value === 'number'
    ) {
      return (propertyValue as { value: number }).value;
    }

    return 0;
  }

  private createDefaultGoal(): GoalDefinition {
    return {
      id: 'Default',
      label: 'Default',
      completion: { type: 'none' },
      candidateActions: [],
    };
  }
}
