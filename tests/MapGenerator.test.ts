/**
 * Tests for the MapGenerator class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MapGenerator } from '../src/utils/MapGenerator';
import { Map } from '@atsu/choukai';

describe('MapGenerator', () => {
  let mapGenerator: MapGenerator;

  beforeEach(() => {
    mapGenerator = new MapGenerator();
  });

  it('should initialize with configuration', () => {
    const config = mapGenerator.getConfig();
    expect(config).toBeDefined();
    expect(config.defaultMapWidth).toBeGreaterThanOrEqual(10); // Reasonable minimum
    expect(config.defaultMapHeight).toBeGreaterThanOrEqual(10); // Reasonable minimum
    expect(config.waterFrequency).toBeGreaterThanOrEqual(0); // Valid probability
    expect(config.waterFrequency).toBeLessThanOrEqual(1); // Valid probability
  });

  it('should generate a single map with specified dimensions', () => {
    const map = mapGenerator.generateMap('Test Map', 15, 10);
    expect(map).toBeInstanceOf(Map);
    expect(map.name).toBe('Test Map');
    expect(map.width).toBe(15);
    expect(map.height).toBe(10);
  });

  it('should generate a map with default dimensions when none provided', () => {
    const map = mapGenerator.generateMap('Default Map');
    expect(map.width).toBe(mapGenerator.getConfig().defaultMapWidth);
    expect(map.height).toBe(mapGenerator.getConfig().defaultMapHeight);
  });

  it('should generate maps with procedural terrain', () => {
    const map = mapGenerator.generateMap('Procedural Map', 20, 20);

    // Count different terrain types to ensure procedural generation worked
    let waterCount = 0;
    let mountainCount = 0;
    let forestCount = 0;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.getTerrain(x, y);
        if (terrain === 'water') waterCount++;
        if (terrain === 'mountain') mountainCount++;
        if (terrain === 'forest') forestCount++;
      }
    }

    // Should have some terrain features based on the frequency settings
    // The exact numbers depend on the random generation, but should have at least some
    expect(waterCount + mountainCount + forestCount).toBeGreaterThan(0);
  });

  it('should generate a world with interconnected maps', () => {
    const world = mapGenerator.generateWorldWithMaps(['Map1', 'Map2', 'Map3']);
    expect(world.getAllMaps().length).toBe(3);

    const maps = world.getAllMaps();
    expect(maps[0].name).toBe('Map1');
    expect(maps[1].name).toBe('Map2');
    expect(maps[2].name).toBe('Map3');
  });

  it('should update configuration at runtime', () => {
    const initialConfig = mapGenerator.getConfig();
    const newConfig = {
      defaultMapWidth: 30,
      defaultMapHeight: 30,
      waterFrequency: 0.1,
    };

    mapGenerator.updateConfig(newConfig);

    const updatedConfig = mapGenerator.getConfig();
    expect(updatedConfig.defaultMapWidth).toBe(30);
    expect(updatedConfig.defaultMapHeight).toBe(30);
    expect(updatedConfig.waterFrequency).toBe(0.1);

    // Reset to initial config
    mapGenerator.updateConfig(initialConfig);
  });

  it('should return a copy of the configuration to prevent external modification', () => {
    const config1 = mapGenerator.getConfig();

    // Modify one of the configs
    config1.defaultMapWidth = 999;

    // The original config in the MapGenerator should not be affected
    const config3 = mapGenerator.getConfig();
    expect(config3.defaultMapWidth).not.toBe(999);
  });
});
