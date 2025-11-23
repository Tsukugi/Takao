/**
 * Represents the basic game state interface
 */
export interface GameState {
  turn: number;
  players: Player[];
  board?: unknown; // Implementation-specific board representation
  resources?: ResourceMap;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Represents a player in the game
 */
export interface Player {
  id: string;
  name: string;
  resources: ResourceMap;
  position?: { x: number; y: number };
  [key: string]: unknown; // Allow additional properties
}

/**
 * Represents a map of resources
 */
export interface ResourceMap {
  [resourceName: string]: number;
}

/**
 * Represents an action that can be taken in the game
 */
export interface Action {
  player: string; // Player name or ID
  type: string;
  description: string;
  payload?: ActionPayload;
  effects?: EffectDefinition[];
}

/**
 * Represents an effect definition for actions
 */
export interface EffectDefinition {
  target: 'unit' | 'self' | 'target' | 'all' | 'ally' | 'enemy';
  property: string;
  operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'set';
  value: EffectValue;
  permanent: boolean;
  condition?: string;
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
 * Interface representing a unit's property snapshot
 */
export interface PropertySnapshot {
  [propertyName: string]: unknown;
}

/**
 * Interface for tracking a unit's complete state
 */
export interface UnitSnapshot {
  id: string;
  name: string;
  type: string;
  properties: PropertySnapshot;
}

/**
 * Interface for representing a stat change
 */
export interface StatChange {
  unitId: string;
  unitName: string;
  propertyName: string;
  oldValue: unknown;
  newValue: unknown;
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
 * Represents action status requirements
 */
export interface ActionStatusRequirements {
  health?: string;
  mana?: string;
}

/**
 * Represents the structure of actions.json
 */
export interface ActionsData {
  actions: {
    low_health: Action[];
    healthy: Action[];
    default: Action[];
  };
  special?: Action[];
}

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
