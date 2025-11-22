/**
 * Represents the basic game state interface
 */
export interface GameState {
  turn: number;
  players: Player[];
  board?: any; // Implementation-specific board representation
  resources?: ResourceMap;
  [key: string]: any; // Allow additional properties
}

/**
 * Represents a player in the game
 */
export interface Player {
  id: string;
  name: string;
  resources: ResourceMap;
  position?: { x: number; y: number };
  [key: string]: any; // Allow additional properties
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
export interface GameAction {
  type: string;
  player: string;
  payload: any;
  turn: number;
  timestamp: number;
}

/**
 * Represents a turn in the game
 */
export interface Turn {
  number: number;
  actions: GameAction[];
  stateBefore: GameState;
  stateAfter: GameState;
}
