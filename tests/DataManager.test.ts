import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataManager } from '../src/utils/DataManager';
import * as fs from 'fs';
import * as path from 'path';

// Create a mock data directory for tests
const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const ACTIONS_FILE = path.join(TEST_DATA_DIR, 'actions.json');
const NAMES_FILE = path.join(TEST_DATA_DIR, 'names.json');
const UNITS_FILE = path.join(TEST_DATA_DIR, 'units.json');
const DIARY_FILE = path.join(TEST_DATA_DIR, 'diary.json');

describe('DataManager', () => {
  beforeEach(() => {
    // Create test data directory
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    }

    // Create test files with sample data
    const actionsData = {
      actions: {
        low_health: [
          {
            type: 'search',
            description: '{{unitName}} searches for health.',
            effect: 'health + 10',
          },
        ],
        healthy: [
          {
            type: 'explore',
            description: '{{unitName}} explores.',
            effect: 'experience + 5',
          },
        ],
        default: [
          {
            type: 'patrol',
            description: '{{unitName}} patrols.',
            effect: 'awareness + 5',
          },
          {
            type: 'rest',
            description: '{{unitName}} rests.',
            effect: 'health + 5',
          },
        ],
      },
    };

    const namesData = {
      male: ['Bob', 'Eric'],
      female: ['Alice', 'Charlie', 'Diana'],
    };

    const unitsData = [
      {
        id: 'test-unit-1',
        name: 'TestWarrior',
        type: 'warrior',
        properties: {
          health: { name: 'health', value: 100, baseValue: 100 },
          mana: { name: 'mana', value: 50, baseValue: 50 },
        },
      },
    ];

    const diaryData = [
      {
        turn: 1,
        action: { type: 'patrol', player: 'TestWarrior' },
        timestamp: new Date().toISOString(),
      },
      {
        turn: 2,
        action: { type: 'rest', player: 'TestWarrior' },
        timestamp: new Date().toISOString(),
      },
    ];

    fs.writeFileSync(ACTIONS_FILE, JSON.stringify(actionsData, null, 2));
    fs.writeFileSync(NAMES_FILE, JSON.stringify(namesData, null, 2));
    fs.writeFileSync(UNITS_FILE, JSON.stringify(unitsData, null, 2));
    fs.writeFileSync(DIARY_FILE, JSON.stringify(diaryData, null, 2));
  });

  afterEach(() => {
    // Clean up test files
    [ACTIONS_FILE, NAMES_FILE, UNITS_FILE, DIARY_FILE].forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmdirSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  it('loads actions from JSON file correctly', () => {
    // Temporarily change data paths for testing
    const originalActionsFile = DataManager.ACTIONS_FILE;
    DataManager.ACTIONS_FILE = ACTIONS_FILE;

    const actionsData = DataManager.loadActions();

    expect(actionsData).toHaveProperty('actions');
    expect(actionsData.actions).toHaveProperty('low_health');
    expect(actionsData.actions).toHaveProperty('healthy');
    expect(actionsData.actions).toHaveProperty('default');
    expect(actionsData.actions.default).toHaveLength(2);
    expect(actionsData.actions.default[0].type).toBe('patrol');
    expect(actionsData.actions.default[1].type).toBe('rest');

    // Restore original path
    DataManager.ACTIONS_FILE = originalActionsFile;
  });

  it('loads names from JSON file correctly', () => {
    // Temporarily change data paths for testing
    const originalNamesFile = DataManager.NAMES_FILE;
    DataManager.NAMES_FILE = NAMES_FILE;

    const names = DataManager.loadNames();

    // With the new structure, we need to check the properties exist
    expect(names).toHaveProperty('male');
    expect(names).toHaveProperty('female');
    expect(names.male).toContain('Bob');
    expect(names.male).toContain('Eric');
    expect(names.female).toContain('Alice');
    expect(names.female).toContain('Charlie');
    expect(names.female).toContain('Diana');

    // Restore original path
    DataManager.NAMES_FILE = originalNamesFile;
  });

  it('loads units from JSON file correctly', () => {
    // Temporarily change data paths for testing
    const originalUnitsFile = DataManager.UNITS_FILE;
    DataManager.UNITS_FILE = UNITS_FILE;

    const units = DataManager.loadUnits();

    expect(units).toHaveLength(1);
    expect(units[0].name).toBe('TestWarrior');
    expect(units[0].type).toBe('warrior');
    expect(units[0].properties.health.value).toBe(100);

    // Restore original path
    DataManager.UNITS_FILE = originalUnitsFile;
  });

  it('loads diary entries from JSON file correctly', () => {
    // Temporarily change data paths for testing
    const originalDiaryFile = DataManager.DIARY_FILE;
    DataManager.DIARY_FILE = DIARY_FILE;

    const diaryEntries = DataManager.loadDiary();

    expect(diaryEntries).toHaveLength(2);
    expect(diaryEntries[0].turn).toBe(1);
    expect(diaryEntries[1].turn).toBe(2);
    expect(diaryEntries[0].action.type).toBe('patrol');
    expect(diaryEntries[1].action.type).toBe('rest');

    // Restore original path
    DataManager.DIARY_FILE = originalDiaryFile;
  });

  it('gets last turn number from diary correctly', () => {
    // Temporarily change data paths for testing
    const originalDiaryFile = DataManager.DIARY_FILE;
    DataManager.DIARY_FILE = DIARY_FILE;

    const lastTurn = DataManager.getLastTurnNumber();

    expect(lastTurn).toBe(2);

    // Restore original path
    DataManager.DIARY_FILE = originalDiaryFile;
  });

  it('returns 0 when diary file does not exist', () => {
    // Temporarily change data paths for testing
    const fakeDiaryFile = path.join(TEST_DATA_DIR, 'nonexistent.json');
    const originalDiaryFile = DataManager.DIARY_FILE;
    DataManager.DIARY_FILE = fakeDiaryFile;

    const lastTurn = DataManager.getLastTurnNumber();

    expect(lastTurn).toBe(0);

    // Restore original path
    DataManager.DIARY_FILE = originalDiaryFile;
  });
});
