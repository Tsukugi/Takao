import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/utils/ConfigManager', () => {
  const config = {
    maxTurnsPerSession: 10,
    runIndefinitely: false,
    cooldownPeriod: 1,
    clearUnitsOnStart: true,
    mapGeneration: {
      defaultMapWidth: 20,
      defaultMapHeight: 20,
      waterFrequency: 0.05,
      mountainFrequency: 0.03,
      forestFrequency: 0.08,
      desertFrequency: 0.04,
      roadFrequency: 0.06,
      swampFrequency: 0.03,
      snowFrequency: 0.02,
      sandFrequency: 0.03,
      minWaterBodySize: 2,
      maxWaterBodySize: 4,
      minMountainRangeLength: 2,
      maxMountainRangeLength: 5,
      minForestAreaSize: 2,
      maxForestAreaSize: 4,
      minTerrainFeatureSpacing: 3,
      unitSpawnNearTerrain: ['road', 'grass'],
      minDistanceBetweenUnits: 5,
      createRoadsBetweenMaps: true,
      maxMapsInWorld: 10,
      enablePerlinNoise: false,
      noiseScale: 0.1,
      seed: 'test-seed',
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

import { GameEngine } from '../src/core/GameEngine';
import { DataManager } from '../src/utils/DataManager';
import { UnitController } from '../src/ai/UnitController';

describe('GameEngine clear units config', () => {
  const saveSpy = vi
    .spyOn(DataManager, 'saveUnits')
    .mockImplementation(() => {});
  const lastTurnSpy = vi
    .spyOn(DataManager, 'getLastTurnNumber')
    .mockReturnValue(0);

  beforeEach(() => {
    saveSpy.mockClear();
    lastTurnSpy.mockClear();
    vi.spyOn(UnitController.prototype, 'initialize').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears saved units before initialization when configured', async () => {
    const engine = new GameEngine();
    await engine.initialize({ turn: 0 });

    expect(saveSpy).toHaveBeenCalledWith([]);
  });
});
