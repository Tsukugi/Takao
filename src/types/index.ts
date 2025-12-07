import type { IMapCell, IMapConfig } from '@atsu/choukai';

/**
 * Represents the basic game state interface
 */
export interface GameState {
  turn: number;
}

/**
 * Represents an action that can be taken in the game
 */
export interface Action {
  player: string; // Player name or ID
  type: string;
  description: string;
  requirements?: Requirement[];
  payload?: ActionPayload;
  effects?: EffectDefinition[];
}

/**
 * Represents a goal definition loaded from data
 */
export interface GoalDefinition {
  id: string;
  label: string;
  scope?: 'unit' | 'squad';
  completion: GoalCompletion;
  candidateActions: string[];
}

/**
 * Goal completion descriptor
 */
export interface GoalCompletion {
  type: 'stat_at_least' | 'condition_met' | 'none';
  stat?: string;
  value?: number;
  condition?: string;
}

/**
 * Represents an effect definition for actions
 */
export interface EffectDefinition {
  target: 'unit' | 'self' | 'target' | 'world' | 'all' | 'ally' | 'enemy';
  property: string;
  operation:
    | 'add'
    | 'subtract'
    | 'multiply'
    | 'divide'
    | 'set'
    | 'create'
    | 'remove';
  value: EffectValue;
  permanent: boolean;
  condition?: string;
}

/**
 * Represents a requirement object that can be either a value requirement or a comparison requirement
 */
export interface Requirement {
  type: string; // E.g. 'comparison', etc.
  value: number;
}

export interface ComparisonRequirement extends Requirement {
  property: string; // E.g. 'health', 'mana', etc. Only used for comparison requirements
  operator: string; // E.g. '>=', '<=', '==', etc. Only used for comparison requirements
}

/**
 * Represents action-specific payload data
 */
export interface ActionPayload {
  [key: string]: string | number | RandomValue | object;
}

export interface ExecutedAction {
  turn: number;
  timestamp: number;
  action: Action;
}

/**
 * Represents a turn in the game
 */
export interface Turn {
  number: number;
  actions: Action[];
  stateBefore: GameState;
  stateAfter: GameState;
}

/**
 * Interface for representing a stat change
 */
export interface StatChange<T = unknown> {
  unitId: string;
  unitName: string;
  propertyName: string;
  oldValue: T;
  newValue: T;
}

/**
 * Represents value specification for an effect
 */
export interface EffectValue {
  type: 'static' | 'calculation' | 'variable' | 'random';
  value?: number;
  expression?: string;
  variable?: string;
  min?: number;
  max?: number;
}

/**
 * Represents a random value definition
 */
export interface RandomValue {
  type: 'random';
  min: number;
  max: number;
}

/**
 * Represents names data structure from names.json
 */
export interface NamesData {
  male?: string[];
  female?: string[];
}

/**
 * Represents the structure of actions.json
 */
export type ActionsData = Action[];
export type GoalsData = GoalDefinition[];

export interface DiaryEntry {
  turn: number;
  timestamp: string;
  action: Action;
}

/**
 * Interface representing an action processor result
 */
export interface ActionProcessingResult {
  success: boolean;
  errorMessage?: string;
}

/**
 * Engine properties and callbacks
 */
export interface EngineProps {
  onTurnStart: (turnNumber: number) => void;
  onTurnEnd: (turnNumber: number) => void;
  onStop: () => void;
  onStart: () => void;
}

/**
 * Serializable map data structure
 */
export interface SerializableMap {
  width: number;
  height: number;
  name: string;
  config?: IMapConfig;
  cells: IMapCell[][];
}
