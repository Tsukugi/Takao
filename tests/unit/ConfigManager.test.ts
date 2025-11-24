import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../../src/utils/ConfigManager';

// Create a backup of the original config
const originalConfigPath = path.resolve('data', 'config.json');
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

  it('loads configuration from config.json when it exists', () => {
    // Write a config file for this test
    const testConfig = {
      maxTurnsPerSession: 75,
      overrideAvailableActions: ['attack', 'defend'],
    };
    fs.writeFileSync(originalConfigPath, JSON.stringify(testConfig));

    // Reset static cache to force reload
    ConfigManager.resetConfig();

    const config = ConfigManager.getConfig();
    expect(config.maxTurnsPerSession).toBe(75);
    expect(config.overrideAvailableActions).toEqual(['attack', 'defend']);
  });

  it('uses default configuration when config.json is invalid', () => {
    // Write invalid JSON to config file
    fs.writeFileSync(originalConfigPath, '{ invalid json }');

    // Reset static cache
    ConfigManager.resetConfig();

    const config = ConfigManager.getConfig();
    expect(config.maxTurnsPerSession).toBe(10); // Default value
    // Default config does not include overrideAvailableActions
  });

  it('uses default configuration when config.json does not exist', () => {
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

  it('loads updated configuration when config.json is modified', () => {
    // Write new config to file
    const newConfig = {
      maxTurnsPerSession: 200,
      overrideAvailableActions: ['attack', 'defend', 'special_action'],
    };
    fs.writeFileSync(originalConfigPath, JSON.stringify(newConfig));

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
    };
    fs.writeFileSync(originalConfigPath, JSON.stringify(modifiedConfig));

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
});
