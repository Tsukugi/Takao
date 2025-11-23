import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnitController } from '../src/ai/UnitController';
import { DataManager } from '../src/utils/DataManager';

// Mock the Atago library
vi.mock('@atsu/atago', async () => {
  const actual = await vi.importActual('fs');
  return {
    BaseUnit: class {
      id: string;
      name: string;
      type: string;
      properties: any;

      constructor(
        id: string,
        name: string,
        type: string,
        initialProperties: any = {}
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
  };
});

// Mock DataManager to return test data
vi.mock('../src/utils/DataManager', async () => {
  const actual = await vi.importActual('../src/utils/DataManager');
  return {
    ...(actual as any),
    DataManager: {
      loadNames: vi.fn(() => ({
        warriors: ['WarriorName', 'BraveWarrior'],
        archers: ['ArcherName', 'SwiftArcher'],
        mages: ['MageName', 'WiseMage'],
        clerics: ['ClericName', 'HealingCleric'],
        general: ['RogueName', 'StealthRogue'],
      })),
      loadUnits: vi.fn(() => []),
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
      warriors: ['WarriorName', 'BraveWarrior'],
      archers: ['ArcherName', 'SwiftArcher'],
      mages: ['MageName', 'WiseMage'],
      clerics: ['ClericName', 'HealingCleric'],
      general: ['RogueName', 'StealthRogue'],
    });
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

    const newState = {
      turn: 5,
      players: [{ id: 'player1', name: 'NewPlayer' }],
    };
    await unitController.updateGameState(newState);

    // Should not throw and should complete without errors
    expect(unitController.getInitialized()).toBe(true);
  });

  it('generates random names from catalog by type', () => {
    const namesCatalog = {
      warriors: ['Alice', 'Bob'],
      general: ['Charlie', 'David'],
    };
    unitController['namesCatalog'] = namesCatalog;

    const name = unitController['getRandomNameByType']('warriors');
    expect(['Alice', 'Bob']).toContain(name);
  });

  it('returns default when names catalog is empty', () => {
    unitController['namesCatalog'] = {};

    const name = unitController['getRandomNameByType']();
    expect(name).toBe('Unknown');
  });
});
