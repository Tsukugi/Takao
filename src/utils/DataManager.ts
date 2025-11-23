import type { BaseUnit } from '@atsu/atago';
import * as fs from 'fs';
import * as path from 'path';
import type { NamesData, ActionsData, DiaryEntry } from '../types';

/**
 * Utility class for managing JSON data files
 */
export class DataManager {
  public static DATA_DIR = path.join(process.cwd(), 'data');
  public static ACTIONS_FILE = path.join(DataManager.DATA_DIR, 'actions.json');
  public static NAMES_FILE = path.join(DataManager.DATA_DIR, 'names.json');
  public static UNITS_FILE = path.join(DataManager.DATA_DIR, 'units.json');
  public static DIARY_FILE = path.join(DataManager.DATA_DIR, 'diary.json');

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
  public static saveUnits(units: BaseUnit[]): void {
    const unitData = units.map(unit => ({
      id: unit.id,
      name: unit.name,
      type: unit.type,
      properties: unit.properties,
    }));

    fs.writeFileSync(this.UNITS_FILE, JSON.stringify(unitData, null, 2));
  }

  /**
   * Saves diary entry to the diary.json file
   */
  public static saveDiaryEntry(entry: DiaryEntry): void {
    let diary: DiaryEntry[] = [];

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
  public static saveDiaryLog(entries: DiaryEntry[]): void {
    fs.writeFileSync(this.DIARY_FILE, JSON.stringify(entries, null, 2));
  }

  /**
   * Loads diary entries
   * If file doesn't exist, returns an empty array
   */
  public static loadDiary(): DiaryEntry[] {
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
  public static loadUnits(): BaseUnit[] {
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
    const diary: DiaryEntry[] = JSON.parse(content);

    if (!diary || diary.length === 0) {
      return 0;
    }

    // Find the highest turn number in the diary
    return Math.max(...diary.map(entry => entry.turn));
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
