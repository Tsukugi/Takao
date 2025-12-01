import { describe, it, expect, beforeEach } from 'vitest';
import { TakaoImpl } from '../../src/TakaoImpl';
import { DataManager } from '../../src/utils/DataManager';
import * as fs from 'fs';
import * as path from 'path';

describe('World Save Integration', () => {
  const worldFile = path.join(DataManager.DATA_DIR, 'world.json');

  beforeEach(() => {
    // Make sure the data directory exists
    DataManager.ensureDataDirectory();

    // Clear any existing world data for a clean test
    if (fs.existsSync(worldFile)) {
      fs.writeFileSync(worldFile, JSON.stringify({ maps: [] }, null, 2));
    }
  });

  it('should save world with maps when engine stops', async () => {
    const takao = new TakaoImpl();

    await takao.initialize();

    // Get the world and verify maps were created
    const world = takao.getWorld();
    const maps = world.getAllMaps();
    expect(maps.length).toBeGreaterThan(0);

    // Stop the engine to trigger save
    takao.stop();

    // Check that the world file was updated
    expect(fs.existsSync(worldFile)).toBe(true);

    // Read the saved world file
    const savedContent = fs.readFileSync(worldFile, 'utf-8');
    const savedData = JSON.parse(savedContent);

    // Verify that maps were saved
    expect(savedData.maps).toBeDefined();
    expect(savedData.maps.length).toBeGreaterThan(0);

    console.log(`Saved ${savedData.maps.length} maps to world.json`);
  });

  it('should load saved maps when engine initializes', async () => {
    // First, create and save a world with maps
    const takao1 = new TakaoImpl();
    await takao1.initialize();
    const world1 = takao1.getWorld();
    const mapsBefore = world1.getAllMaps();
    expect(mapsBefore.length).toBeGreaterThan(0);
    takao1.stop();

    // Verify the file was written
    expect(fs.existsSync(worldFile)).toBe(true);
    const contentBefore = fs.readFileSync(worldFile, 'utf-8');
    const dataBefore = JSON.parse(contentBefore);
    expect(dataBefore.maps.length).toBeGreaterThan(0);

    // Create a new instance and verify it loads the saved maps
    const takao2 = new TakaoImpl();
    await takao2.initialize();
    const world2 = takao2.getWorld();
    const mapsAfter = world2.getAllMaps();

    expect(mapsAfter.length).toBeGreaterThan(0);
    expect(mapsAfter.length).toBe(dataBefore.maps.length);

    takao2.stop();
  });
});
