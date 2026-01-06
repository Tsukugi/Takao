/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnitController } from '../src/ai/UnitController';
import { DataManager } from '../src/utils/DataManager';
import { GameState } from '../src/types';

const mockBestiary = [
  {
    id: 'wolf',
    name: 'Wolf',
    type: 'beast',
    properties: {
      health: { name: 'health', value: 60, baseValue: 60 },
      status: { name: 'status', value: 'alive', baseValue: 'alive' },
    },
  },
];

// Mock the Atago library
vi.mock('@atsu/atago', async () => {
  return {
    BaseUnit: class {
      id: string;
      name: string;
      type: string;
      properties: Record<string, { name: string; value: any; baseValue: any }>;

      constructor(
        id: string,
        name: string,
        type: string,
        initialProperties = {}
      ) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.properties = initialProperties || {};
      }

      getPropertyValue(propName: string) {
        const prop = this.properties[propName];
        return prop ? prop.value : undefined;
      }

      setProperty(propName: string, value: any) {
        if (this.properties[propName]) {
          this.properties[propName].value = value;
        } else {
          this.properties[propName] = {
            name: propName,
            value,
            baseValue: value,
          };
        }
      }
    },
    isPosition: (value: unknown): value is { x: number; y: number } =>
      !!value &&
      typeof value === 'object' &&
      typeof (value as any).x === 'number' &&
      typeof (value as any).y === 'number',
    isUnitPosition: (
      value: unknown
    ): value is {
      unitId: string;
      mapId: string;
      position: { x: number; y: number };
    } => {
      if (!value || typeof value !== 'object') return false;
      const candidate = value as any;
      return (
        typeof candidate.unitId === 'string' &&
        typeof candidate.mapId === 'string' &&
        !!candidate.position &&
        typeof candidate.position.x === 'number' &&
        typeof candidate.position.y === 'number'
      );
    },
  };
});

// Mock DataManager to return test data
vi.mock('../src/utils/DataManager', async () => {
  const actual = await vi.importActual('../src/utils/DataManager');
  return {
    ...actual,
    DataManager: {
      loadNames: vi.fn(() => ({
        male: ['WarriorName', 'BraveWarrior'],
        female: ['ArcherName', 'SwiftArcher'],
      })),
      loadBeastiary: vi.fn(() => mockBestiary),
      loadUnits: vi.fn(() => []),
      saveUnits: vi.fn(() => undefined),
      ensureDataDirectory: vi.fn(),
    },
  };
});

describe('UnitController', () => {
  let unitController: UnitController;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the DataManager to return test names
    (DataManager.loadNames as any).mockReturnValue({
      male: ['WarriorName', 'BraveWarrior'],
      female: ['ArcherName', 'SwiftArcher'],
    });
    (DataManager.loadBeastiary as any).mockReturnValue(mockBestiary);
    (DataManager.loadUnits as any).mockReturnValue([]);

    unitController = new UnitController();
  });

  it('initializes with provided game state', async () => {
    const gameState = { turn: 0, players: [] };

    await unitController.initialize(gameState);

    expect(unitController.getInitialized()).toBe(true);
  });

  it('creates new units when no saved units exist', async () => {
    // Mock to return empty array for saved units
    (DataManager.loadUnits as any).mockReturnValue([]);

    const gameState = { turn: 0, players: [] };
    await unitController.initialize(gameState);

    const units = unitController.getUnits();
    expect(units).toHaveLength(2); // Should create 2 default units

    const unit1 = units[0];
    const unit2 = units[1];
    expect(unit1.getPropertyValue('faction')).toBe('Neutral');
    expect(unit2.getPropertyValue('faction')).toBe('Neutral');

    // Check that the names are from the expected categories
    expect(['WarriorName', 'BraveWarrior']).toContain(unit1.name);
    expect(['ArcherName', 'SwiftArcher']).toContain(unit2.name);

    expect(unit1.type).toBe('warrior');
    expect(unit2.type).toBe('archer');
  });

  it('loads existing units when saved units exist', async () => {
    // Mock to return existing units
    const mockSavedUnits = [
      {
        id: 'existing-unit-1',
        name: 'ExistingWarrior',
        type: 'warrior',
        properties: {
          health: { name: 'health', value: 90, baseValue: 100 },
          attack: { name: 'attack', value: 25, baseValue: 20 },
          status: { name: 'status', value: 'alive', baseValue: 'alive' },
          maxHealth: { name: 'maxHealth', value: 100, baseValue: 100 },
          maxMana: { name: 'maxMana', value: 50, baseValue: 50 },
        },
      },
    ];

    (DataManager.loadUnits as any).mockReturnValue(mockSavedUnits);

    const gameState = { turn: 0, players: [] };
    await unitController.initialize(gameState);

    const units = unitController.getUnits();
    expect(units).toHaveLength(1); // Loaded from saved state
    expect(units[0].name).toBe('ExistingWarrior');
    expect(units[0].type).toBe('warrior');
    expect(units[0].id).toBe('existing-unit-1');
    expect(units[0].getPropertyValue('faction')).toBe('Neutral');
  });

  it('gets unit state correctly', async () => {
    const gameState = { turn: 0, players: [] };
    await unitController.initialize(gameState);

    const unitState = await unitController.getUnitState();

    expect(Array.isArray(unitState)).toBe(true);
    expect(unitState.length).toBeGreaterThan(0);
  });

  it('updates game state correctly', async () => {
    const gameState = { turn: 0, players: [] };
    await unitController.initialize(gameState);

    const newState: Partial<GameState> = {
      turn: 5,
    };
    await unitController.updateGameState(newState);

    // Should not throw and should complete without errors
    expect(unitController.getInitialized()).toBe(true);
  });

  it('creates units from bestiary entries', async () => {
    const gameState = { turn: 0, players: [] };
    await unitController.initialize(gameState);

    const unit = await unitController.addUnitFromBeastiary('wolf', {
      name: 'Alpha Wolf',
    });

    expect(unit.name).toBe('Alpha Wolf');
    expect(unit.type).toBe('beast');
    expect(unit.getPropertyValue('health')).toBe(60);
    expect(unitController.getUnits()).toContain(unit);
  });

  it('does not mutate bestiary templates when spawning units', async () => {
    const gameState = { turn: 0, players: [] };
    await unitController.initialize(gameState);

    const unit = await unitController.addUnitFromBeastiary('wolf');
    unit.setProperty('health', 10);

    expect(mockBestiary[0].properties.health.value).toBe(60);
  });

  it('throws when spawning from missing bestiary entry', async () => {
    const gameState = { turn: 0, players: [] };
    await unitController.initialize(gameState);

    await expect(
      unitController.addUnitFromBeastiary('missing')
    ).rejects.toThrow('Beastiary entry not found: missing');
  });

  it('generates random names from catalog by type', () => {
    const namesCatalog = {
      male: ['David', 'Bob'],
      female: ['Ana', 'Maria'],
    };
    unitController['namesCatalog'] = namesCatalog;

    const name = unitController['getRandomName'](true); // Male
    expect(['David', 'Bob']).toContain(name);
    const femaleName = unitController['getRandomName'](false); // Female
    expect(['Ana', 'Maria']).toContain(femaleName);
  });

  it('returns default when names catalog is empty', () => {
    unitController['namesCatalog'] = {};

    const name = unitController['getRandomName']();
    expect(name).toBe('Unknown');
  });
});
