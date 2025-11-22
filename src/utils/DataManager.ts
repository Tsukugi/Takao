import * as fs from 'fs';
import * as path from 'path';

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
 * Represents an effect definition
 */
export interface EffectDefinition {
  target: 'self' | 'target' | 'all' | 'ally' | 'enemy';
  property: string;
  operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'set';
  value: EffectValue;
  permanent: boolean;
  condition?: string;
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
  warriors?: string[];
  archers?: string[];
  mages?: string[];
  clerics?: string[];
  general?: string[];
  [key: string]: string[] | undefined; // Allow other categories
}

/**
 * Represents action-specific payload data
 */
export interface ActionPayload {
  [key: string]: string | number | RandomValue | object;
}

/**
 * Represents action status requirements
 */
export interface ActionStatusRequirements {
  health?: string;
  mana?: string;
  [key: string]: string | undefined;
}

/**
 * Represents a possible game action with effect definitions loaded from JSON
 */
export interface ActionWithEffects {
  type: string;
  description: string;
  effects: EffectDefinition[];
  payload?: ActionPayload;
  manaRequirement?: number;
  requiredStatus?: ActionStatusRequirements;
  targetStatus?: string;
}

/**
 * Represents the structure of actions.json
 */
export interface ActionsData {
  actions: {
    low_health: ActionWithEffects[];
    healthy: ActionWithEffects[];
    default: ActionWithEffects[];
  };
  special?: ActionWithEffects[];
}

/**
 * Utility class for managing JSON data files
 */
export class DataManager {
  private static readonly DATA_DIR = path.join(process.cwd(), 'data');
  private static readonly ACTIONS_FILE = path.join(DataManager.DATA_DIR, 'actions.json');
  private static readonly NAMES_FILE = path.join(DataManager.DATA_DIR, 'names.json');
  private static readonly UNITS_FILE = path.join(DataManager.DATA_DIR, 'units.json');
  private static readonly DIARY_FILE = path.join(DataManager.DATA_DIR, 'diary.json');

  /**
   * Loads action templates from the actions.json file
   */
  public static loadActions(): ActionsData {
    if (!fs.existsSync(this.ACTIONS_FILE)) {
      throw new Error(`Actions file not found: ${this.ACTIONS_FILE}`);
    }

    const data = fs.readFileSync(this.ACTIONS_FILE, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Saves unit states to the units.json file
   */
  public static saveUnits(units: any[]): void {
    const unitData = units.map(unit => ({
      id: unit.id,
      name: unit.name,
      type: unit.type,
      properties: unit.properties
    }));
    
    fs.writeFileSync(this.UNITS_FILE, JSON.stringify(unitData, null, 2));
  }

  /**
   * Saves diary entry to the diary.json file
   */
  public static saveDiaryEntry(entry: any): void {
    let diary: any[] = [];
    
    if (fs.existsSync(this.DIARY_FILE)) {
      const content = fs.readFileSync(this.DIARY_FILE, 'utf-8');
      diary = JSON.parse(content);
    }
    
    diary.push(entry);
    
    fs.writeFileSync(this.DIARY_FILE, JSON.stringify(diary, null, 2));
  }

  /**
   * Saves a full diary log
   */
  public static saveDiaryLog(entries: any[]): void {
    fs.writeFileSync(this.DIARY_FILE, JSON.stringify(entries, null, 2));
  }

  /**
   * Loads diary entries
   * If file doesn't exist, returns an empty array
   */
  public static loadDiary(): any[] {
    if (!fs.existsSync(this.DIARY_FILE)) {
      return [];
    }

    const content = fs.readFileSync(this.DIARY_FILE, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Loads unit states from the units.json file
   * If file doesn't exist, returns an empty array
   */
  public static loadUnits(): any[] {
    if (!fs.existsSync(this.UNITS_FILE)) {
      return [];
    }

    const content = fs.readFileSync(this.UNITS_FILE, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Gets the last turn number from the diary entries
   * If file doesn't exist or is empty, returns 0
   */
  public static getLastTurnNumber(): number {
    if (!fs.existsSync(this.DIARY_FILE)) {
      return 0;
    }

    const content = fs.readFileSync(this.DIARY_FILE, 'utf-8');
    const diary: any[] = JSON.parse(content);

    if (!diary || diary.length === 0) {
      return 0;
    }

    // Find the highest turn number in the diary
    return Math.max(...diary.map((entry: any) => entry.turn));
  }

  /**
   * Loads names catalog from the names.json file
   */
  public static loadNames(): NamesData {
    if (!fs.existsSync(this.NAMES_FILE)) {
      throw new Error(`Names file not found: ${this.NAMES_FILE}`);
    }

    const data = fs.readFileSync(this.NAMES_FILE, 'utf-8');
    const jsonData = JSON.parse(data);
    return jsonData;
  }

  /**
   * Creates data directory if it doesn't exist
   */
  public static ensureDataDirectory(): void {
    if (!fs.existsSync(this.DATA_DIR)) {
      fs.mkdirSync(this.DATA_DIR, { recursive: true });
    }
  }
}