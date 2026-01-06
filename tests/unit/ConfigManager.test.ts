import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../../src/utils/ConfigManager';

// Create a backup of the original config
const originalConfigPath = path.resolve('data', 'engine.config.ts');
let originalConfig: string | null = null;

describe('ConfigManager', () => {
  beforeEach(() => {
    // Backup original config
    if (fs.existsSync(originalConfigPath)) {
      originalConfig = fs.readFileSync(originalConfigPath, 'utf8');
    }
  });

  afterEach(() => {
    // Restore original config after each test
    if (originalConfig !== null) {
      fs.writeFileSync(originalConfigPath, originalConfig);
    }
    // Reset the static config property by accessing it through a new instance
    // Since it's static, we need to manually reset it
    ConfigManager.resetConfig();
  });

  it('loads configuration from engine.config.ts when it exists', () => {
    // Write a config file for this test
    const testConfig = {
      maxTurnsPerSession: 75,
      overrideAvailableActions: ['attack', 'defend'],
      rendering: { visualOnly: false },
    };
    fs.writeFileSync(
      originalConfigPath,
      `export default ${JSON.stringify(testConfig)};`
    );

    // Reset static cache to force reload
    ConfigManager.resetConfig();

    const config = ConfigManager.getConfig();
    expect(config.maxTurnsPerSession).toBe(75);
    expect(config.overrideAvailableActions).toEqual(['attack', 'defend']);
  });

  it('uses default configuration when engine.config.ts is invalid', () => {
    // Write invalid TS to config file
    fs.writeFileSync(originalConfigPath, 'export default { invalid');

    // Reset static cache
    ConfigManager.resetConfig();

    const config = ConfigManager.getConfig();
    expect(config.maxTurnsPerSession).toBe(10); // Default value
    // Default config does not include overrideAvailableActions
  });

  it('uses default configuration when engine.config.ts does not exist', () => {
    // Remove config file temporarily
    if (fs.existsSync(originalConfigPath)) {
      fs.renameSync(originalConfigPath, originalConfigPath + '.backup');
    }

    // Reset static cache
    ConfigManager.resetConfig();

    const config = ConfigManager.getConfig();
    expect(config.maxTurnsPerSession).toBe(10); // Default value
    // Default config does not include overrideAvailableActions

    // Restore config file
    if (fs.existsSync(originalConfigPath + '.backup')) {
      fs.renameSync(originalConfigPath + '.backup', originalConfigPath);
    }
  });

  it('loads updated configuration when engine.config.ts is modified', () => {
    // Write new config to file
    const newConfig = {
      maxTurnsPerSession: 200,
      overrideAvailableActions: ['attack', 'defend', 'special_action'],
      rendering: { visualOnly: false },
    };
    fs.writeFileSync(
      originalConfigPath,
      `export default ${JSON.stringify(newConfig)};`
    );

    // Reset static cache to force reload
    ConfigManager.resetConfig();

    const config = ConfigManager.getConfig();
    expect(config.maxTurnsPerSession).toBe(200);
    expect(config.overrideAvailableActions).toEqual([
      'attack',
      'defend',
      'special_action',
    ]);
  });

  it('caches configuration after first load', () => {
    // Load config first time
    const firstConfig = ConfigManager.getConfig();

    // Modify config file
    const modifiedConfig = {
      maxTurnsPerSession: 999,
      overrideAvailableActions: ['modified'],
      rendering: { visualOnly: false },
    };
    fs.writeFileSync(
      originalConfigPath,
      `export default ${JSON.stringify(modifiedConfig)};`
    );

    // Load config second time - should be cached
    const secondConfig = ConfigManager.getConfig();

    // They should be the same object due to caching
    expect(firstConfig).toBe(secondConfig);
    expect(firstConfig.maxTurnsPerSession).not.toBe(999); // Should be original value
  });

  it('returns the same config instance on subsequent calls', () => {
    const firstCall = ConfigManager.getConfig();
    const secondCall = ConfigManager.getConfig();

    expect(firstCall).toBe(secondCall);
  });

  it('loads map generation configuration from engine.config.ts', () => {
    // Use the actual config file
    const config = ConfigManager.getConfig();

    expect(config.mapGeneration).toBeDefined();
    expect(config.mapGeneration?.defaultMapWidth).toBe(25); // From our engine.config.ts
    expect(config.mapGeneration?.defaultMapHeight).toBe(25); // From our engine.config.ts
    expect(config.mapGeneration?.waterFrequency).toBe(0.08); // From our engine.config.ts
    expect(config.mapGeneration?.createRoadsBetweenMaps).toBe(true); // From our engine.config.ts
  });

  it('gets only map generation configuration', () => {
    const mapConfig = ConfigManager.getMapGenerationConfig();

    expect(mapConfig.defaultMapWidth).toBe(25);
    expect(mapConfig.defaultMapHeight).toBe(25);
    expect(mapConfig.waterFrequency).toBe(0.08);
    expect(mapConfig.createRoadsBetweenMaps).toBe(true);
  });

  it('uses default map generation config when not specified in engine.config.ts', () => {
    // Create a temporary config file without mapGeneration
    const tempConfigPath = path.resolve('data', 'temp_config.ts');
    const originalConfigPath = path.resolve('data', 'engine.config.ts');

    if (fs.existsSync(originalConfigPath)) {
      originalConfig = fs.readFileSync(originalConfigPath, 'utf8');
    }

    try {
      // Write config without mapGeneration
      const tempConfig = {
        maxTurnsPerSession: 15,
        rendering: { visualOnly: false },
      };
      fs.writeFileSync(
        tempConfigPath,
        `export default ${JSON.stringify(tempConfig)};`
      );

      // Rename the files to use our temp config
      if (fs.existsSync(originalConfigPath)) {
        fs.renameSync(originalConfigPath, originalConfigPath + '.backup');
      }
      fs.renameSync(tempConfigPath, originalConfigPath);

      // Reset and reload config
      ConfigManager.resetConfig();
      const config = ConfigManager.getConfig();

      // When mapGeneration is not specified, it should be undefined in the partial config
      // but getMapGenerationConfig() should still provide defaults
      expect(config.mapGeneration).toBeUndefined();

      // However, getMapGenerationConfig should still provide defaults
      ConfigManager.resetConfig(); // Reset first to reload with original config
      const mapConfig = ConfigManager.getMapGenerationConfig();
      expect(mapConfig.defaultMapWidth).toBe(20); // Should use default
      expect(mapConfig.defaultMapHeight).toBe(20); // Should use default
      expect(config.maxTurnsPerSession).toBe(15); // From custom config
    } finally {
      // Restore original config file
      if (fs.existsSync(originalConfigPath)) {
        fs.unlinkSync(originalConfigPath);
      }
      if (fs.existsSync(originalConfigPath + '.backup')) {
        fs.renameSync(originalConfigPath + '.backup', originalConfigPath);
      }
      if (fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
      }

      // Reset config again
      ConfigManager.resetConfig();
    }
  });

  it('handles invalid engine.config.ts gracefully for map generation', () => {
    const tempConfigPath = path.resolve('data', 'temp_config_invalid.ts');
    const originalConfigPath = path.resolve('data', 'engine.config.ts');

    if (fs.existsSync(originalConfigPath)) {
      originalConfig = fs.readFileSync(originalConfigPath, 'utf8');
    }

    try {
      // Write invalid config
      fs.writeFileSync(tempConfigPath, 'export default { invalid');

      // Rename the files to use our invalid config
      if (fs.existsSync(originalConfigPath)) {
        fs.renameSync(originalConfigPath, originalConfigPath + '.backup');
      }
      fs.renameSync(tempConfigPath, originalConfigPath);

      // Reset and reload config
      ConfigManager.resetConfig();
      const config = ConfigManager.getConfig();

      // Should fall back to defaults
      expect(config.mapGeneration?.defaultMapWidth).toBe(20);
      expect(config.mapGeneration?.defaultMapHeight).toBe(20);
    } finally {
      // Restore original config file
      if (fs.existsSync(originalConfigPath)) {
        fs.unlinkSync(originalConfigPath);
      }
      if (fs.existsSync(originalConfigPath + '.backup')) {
        fs.renameSync(originalConfigPath + '.backup', originalConfigPath);
      }
      if (fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
      }

      // Reset config again
      ConfigManager.resetConfig();
    }
  });
});
