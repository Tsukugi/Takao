import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseUnit } from '@atsu/atago';
import { TakaoImpl } from '../src/TakaoImpl';
import type { DiaryEntry } from '../src/types';

vi.mock('../src/utils/ConfigManager', () => {
  const config = {
    maxTurnsPerSession: 5,
    runIndefinitely: false,
    cooldownPeriod: 1,
    clearUnitsOnStart: false,
    mapGeneration: {
      defaultMapWidth: 10,
      defaultMapHeight: 10,
      waterFrequency: 0.05,
      mountainFrequency: 0.05,
      forestFrequency: 0.05,
      desertFrequency: 0.05,
      roadFrequency: 0.05,
      swampFrequency: 0.05,
      snowFrequency: 0.05,
      sandFrequency: 0.05,
      minWaterBodySize: 1,
      maxWaterBodySize: 2,
      minMountainRangeLength: 1,
      maxMountainRangeLength: 2,
      minForestAreaSize: 1,
      maxForestAreaSize: 2,
      minTerrainFeatureSpacing: 1,
      unitSpawnNearTerrain: [],
      minDistanceBetweenUnits: 1,
      createRoadsBetweenMaps: false,
      maxMapsInWorld: 2,
      enablePerlinNoise: false,
      noiseScale: 0.1,
      seed: 'test',
    },
    rendering: { visualOnly: true },
  };

  return {
    ConfigManager: {
      getConfig: vi.fn(() => config),
      getDefaultConfig: vi.fn(() => config),
      getMapGenerationConfig: vi.fn(() => config.mapGeneration),
    },
  };
});

describe('TakaoImpl defeated animal handling', () => {
  const createUnits = () => {
    const hero = new BaseUnit('hero-1', 'Hero', 'warrior', {
      health: { name: 'health', value: 50, baseValue: 50 },
      resources: { name: 'resources', value: 2, baseValue: 2 },
      faction: {
        name: 'faction',
        value: 'Adventurers',
        baseValue: 'Adventurers',
      },
      status: { name: 'status', value: 'alive', baseValue: 'alive' },
    });

    const wolf = new BaseUnit('wolf-1', 'Wolf', 'wolf', {
      health: { name: 'health', value: 0, baseValue: 10 },
      resources: { name: 'resources', value: 3, baseValue: 3 },
      faction: {
        name: 'faction',
        value: 'Wild Animals',
        baseValue: 'Wild Animals',
      },
      status: { name: 'status', value: 'dead', baseValue: 'alive' },
    });

    return { hero, wolf };
  };

  let impl: TakaoImpl;
  let getUnits: ReturnType<typeof vi.fn>;
  let removeUnit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    impl = new TakaoImpl();
    const { hero, wolf } = createUnits();

    getUnits = vi.fn(() => [hero, wolf]);
    removeUnit = vi.fn(() => true);

    const storyTeller = {
      getDiary: vi.fn<() => DiaryEntry[]>(() => []),
      getWorld: vi.fn(() => ({ getAllMaps: () => [] })),
    };

    (impl as any).gameEngine = {
      getUnitController: () =>
        ({
          getUnits,
          removeUnit,
        }) as unknown,
      getStoryTeller: () => storyTeller,
      getConfig: () => ({ rendering: { visualOnly: true } }),
      getTurnManager: () => ({ getCurrentTurn: () => 0 }),
    } as any;

    (impl as any).lastDiaryIndex = 0;
    (impl as any).processedDeadUnits = new Set();
  });

  it('removes defeated wild animals and transfers resources to the killer', () => {
    const { hero, wolf } = createUnits();
    getUnits.mockReturnValue([hero, wolf]);

    (impl as any).handleNewDiaryEntries([
      {
        turn: 1,
        timestamp: new Date().toISOString(),
        action: {
          player: hero.id,
          type: 'attack',
          description: '',
          payload: { targetUnit: wolf.id },
        },
      },
    ]);

    expect(removeUnit).toHaveBeenCalledWith(wolf.id);
    const heroResources = hero.getPropertyValue('resources') as {
      value: number;
    };
    const heroResourceValue =
      typeof heroResources === 'number' ? heroResources : heroResources.value;
    expect(heroResourceValue).toBe(5);
  });

  it('ignores non-animal defeats', () => {
    const hero = new BaseUnit('hero-1', 'Hero', 'warrior', {
      health: { name: 'health', value: 0, baseValue: 50 },
      resources: { name: 'resources', value: 2, baseValue: 2 },
      faction: {
        name: 'faction',
        value: 'Adventurers',
        baseValue: 'Adventurers',
      },
      status: { name: 'status', value: 'dead', baseValue: 'alive' },
    });
    const ally = new BaseUnit('ally-1', 'Ally', 'warrior', {
      health: { name: 'health', value: 10, baseValue: 10 },
      resources: { name: 'resources', value: 0, baseValue: 0 },
      faction: {
        name: 'faction',
        value: 'Adventurers',
        baseValue: 'Adventurers',
      },
      status: { name: 'status', value: 'alive', baseValue: 'alive' },
    });

    getUnits.mockReturnValue([hero, ally]);

    (impl as any).handleNewDiaryEntries([
      {
        turn: 1,
        timestamp: new Date().toISOString(),
        action: {
          player: ally.id,
          type: 'attack',
          description: '',
          payload: { targetUnit: hero.id },
        },
      },
    ]);

    expect(removeUnit).not.toHaveBeenCalled();
    const allyResources = ally.getPropertyValue('resources') as {
      value: number;
    };
    const allyResourceValue =
      typeof allyResources === 'number' ? allyResources : allyResources.value;
    expect(allyResourceValue).toBe(0);
  });
});
