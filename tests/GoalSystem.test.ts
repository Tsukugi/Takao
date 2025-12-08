import { describe, it, expect } from 'vitest';
import { BaseUnit } from '@atsu/atago';
import { GoalSystem } from '../src/ai/goals/GoalSystem';
import type { Action, GoalDefinition } from '../src/types';

const goals: GoalDefinition[] = [
  {
    id: 'RecoverHealth',
    label: 'Recover Health',
    scope: 'unit',
    completion: { type: 'stat_at_least', stat: 'health', value: 70 },
    candidateActions: ['rest', 'retreat', 'meditate', 'search'],
  },
  {
    id: 'RecoverMana',
    label: 'Recover Mana',
    scope: 'unit',
    completion: { type: 'stat_at_least', stat: 'mana', value: 50 },
    candidateActions: ['conserve_mana', 'meditate', 'rest'],
  },
  {
    id: 'AttackEnemy',
    label: 'Attack Enemy',
    scope: 'unit',
    completion: { type: 'condition_met', condition: 'no_hostile_in_range' },
    candidateActions: ['attack', 'desperate_attack'],
  },
  {
    id: 'Explore',
    label: 'Explore',
    scope: 'unit',
    completion: { type: 'none' },
    candidateActions: ['explore', 'scout', 'patrol'],
  },
];

const actions: Action[] = [
  { player: 'any', type: 'rest', description: 'rest' },
  { player: 'any', type: 'retreat', description: 'retreat' },
  { player: 'any', type: 'meditate', description: 'meditate' },
  { player: 'any', type: 'search', description: 'search' },
  { player: 'any', type: 'conserve_mana', description: 'conserve mana' },
  { player: 'any', type: 'attack', description: 'attack' },
  { player: 'any', type: 'desperate_attack', description: 'desperate attack' },
  { player: 'any', type: 'explore', description: 'explore' },
];

const buildUnit = (
  health: number,
  maxHealth: number,
  mana: number,
  maxMana: number,
  id: string = 'id',
  faction: string = 'Adventurers'
) =>
  new BaseUnit(id, 'TestUnit', 'type', {
    health: { name: 'health', value: health, baseValue: maxHealth },
    maxHealth: { name: 'maxHealth', value: maxHealth, baseValue: maxHealth },
    mana: { name: 'mana', value: mana, baseValue: maxMana },
    maxMana: { name: 'maxMana', value: maxMana, baseValue: maxMana },
    faction: { name: 'faction', value: faction, baseValue: faction },
  });

describe('GoalSystem', () => {
  it('chooses recover health goal and healing action when health is low', () => {
    const system = new GoalSystem(goals);
    const unit = buildUnit(20, 100, 50, 50);

    const choice = system.chooseAction(unit, {
      availableActions: actions,
      turn: 1,
    });

    expect(choice.goal.id).toBe('RecoverHealth');
    expect(choice.action?.type).toBe('rest'); // first candidate in goals list
  });

  it('chooses recover mana goal when mana is low but health is fine', () => {
    const system = new GoalSystem(goals);
    const unit = buildUnit(80, 100, 10, 100);

    const choice = system.chooseAction(unit, {
      availableActions: actions,
      turn: 1,
    });

    expect(choice.goal.id).toBe('RecoverMana');
    expect(choice.action?.type).toBe('conserve_mana');
  });

  it('falls back to attack when no urgent recovery is needed', () => {
    const system = new GoalSystem(goals);
    const unit = buildUnit(90, 100, 80, 100);

    const choice = system.chooseAction(unit, {
      availableActions: actions,
      turn: 1,
    });

    expect(choice.goal.id).toBe('AttackEnemy');
    expect(['attack', 'desperate_attack']).toContain(choice.action?.type);
  });

  it('uses available actions intersection for a goal', () => {
    const system = new GoalSystem(goals);
    const unit = buildUnit(90, 100, 80, 100);
    const onlyAttack: Action[] = [
      { player: 'any', type: 'attack', description: 'attack' },
    ];

    const choice = system.chooseAction(unit, {
      availableActions: onlyAttack,
      turn: 1,
    });

    expect(choice.goal.id).toBe('AttackEnemy');
    expect(choice.action?.type).toBe('attack');
  });

  it('chooses explore when no hostile units exist', () => {
    const system = new GoalSystem(goals);
    const actor = buildUnit(90, 100, 80, 100, 'actor', 'Adventurers');
    const ally = buildUnit(90, 100, 80, 100, 'ally', 'Adventurers');

    const choice = system.chooseAction(actor, {
      availableActions: actions,
      units: [actor, ally],
      turn: 1,
    });

    expect(choice.goal.id).toBe('Explore');
    expect(['explore', 'scout', 'patrol']).toContain(choice.action?.type);
  });

  it('prefers attack when hostile units are present', () => {
    const system = new GoalSystem(goals);
    const actor = buildUnit(90, 100, 80, 100, 'actor', 'Adventurers');
    const hostile = buildUnit(90, 100, 80, 100, 'wolf', 'Wild Animals');

    const choice = system.chooseAction(actor, {
      availableActions: actions,
      units: [actor, hostile],
      turn: 1,
    });

    expect(choice.goal.id).toBe('AttackEnemy');
    expect(['attack', 'desperate_attack']).toContain(choice.action?.type);
  });

  it('falls back gracefully when goal has no matching available action', () => {
    const system = new GoalSystem(goals);
    const unit = buildUnit(20, 100, 50, 50);
    const onlyExplore: Action[] = [
      { player: 'any', type: 'explore', description: 'explore' },
    ];

    const choice = system.chooseAction(unit, {
      availableActions: onlyExplore,
      turn: 1,
    });

    expect(choice.action?.type).toBe('explore');
  });
});
