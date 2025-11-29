import * as fs from 'fs';
import * as path from 'path';

// Main application configuration
interface AppConfig {
  maxTurnsPerSession: number;
  overrideAvailableActions?: string[];
}

// Map generation configuration
export interface MapGenerationConfig {
  // Map dimensions settings
  defaultMapWidth: number;
  defaultMapHeight: number;

  // Terrain frequency settings (0-1 probability)
  waterFrequency: number;
  mountainFrequency: number;
  forestFrequency: number;
  desertFrequency: number;
  roadFrequency: number;
  swampFrequency: number;
  snowFrequency: number;
  sandFrequency: number;

  // Feature generation settings
  minWaterBodySize: number;
  maxWaterBodySize: number;
  minMountainRangeLength: number;
  maxMountainRangeLength: number;
  minForestAreaSize: number;
  maxForestAreaSize: number;
  minTerrainFeatureSpacing: number;

  // Unit placement settings
  unitSpawnNearTerrain: string[];
  minDistanceBetweenUnits: number;

  // Map connection settings
  createRoadsBetweenMaps: boolean;
  maxMapsInWorld: number;

  // Procedural generation settings
  enablePerlinNoise: boolean; // For more natural terrain generation
  noiseScale: number;
  seed: string;
}

// Combined configuration interface
export interface FullConfig extends AppConfig {
  mapGeneration: Partial<MapGenerationConfig>;
  rendering: {
    visualOnly: boolean;
  };
}

export class ConfigManager {
  private static config: FullConfig | null = null;

  /**
   * Load the configuration from the JSON file
   */
  public static loadConfig(): FullConfig {
    if (this.config) {
      return this.config;
    }

    // Try to load from config file in data directory
    const configPath = path.resolve('data', 'config.json');

    if (fs.existsSync(configPath)) {
      const configRaw = fs.readFileSync(configPath, 'utf8');
      try {
        this.config = JSON.parse(configRaw) as FullConfig;
      } catch (error) {
        console.warn('Invalid config.json format, using defaults:', error);
        this.config = this.getDefaultConfig();
      }
    } else {
      console.warn('config.json not found, using defaults');
      this.config = this.getDefaultConfig();
    }

    return this.config;
  }

  public static getDefaultConfig(): FullConfig {
    return {
      maxTurnsPerSession: 10,
      mapGeneration: {
        // Map dimensions settings
        defaultMapWidth: 20,
        defaultMapHeight: 20,

        // Terrain frequency settings (0-1 probability)
        waterFrequency: 0.05,
        mountainFrequency: 0.03,
        forestFrequency: 0.08,
        desertFrequency: 0.04,
        roadFrequency: 0.06,
        swampFrequency: 0.03,
        snowFrequency: 0.02,
        sandFrequency: 0.03,

        // Feature generation settings
        minWaterBodySize: 2,
        maxWaterBodySize: 4,
        minMountainRangeLength: 2,
        maxMountainRangeLength: 5,
        minForestAreaSize: 2,
        maxForestAreaSize: 4,
        minTerrainFeatureSpacing: 3,

        // Unit placement settings
        unitSpawnNearTerrain: ['road', 'grass'],
        minDistanceBetweenUnits: 5,

        // Map connection settings
        createRoadsBetweenMaps: true,
        maxMapsInWorld: 10,

        // Procedural generation settings
        enablePerlinNoise: false,
        noiseScale: 0.1,
        seed: Date.now().toString(),
      },
      rendering: {
        visualOnly: false,
      },
    };
  }

  /**
   * Get engine configuration
   */
  public static getConfig(): FullConfig {
    return this.loadConfig();
  }

  /**
   * Get only map generation configuration
   */
  public static getMapGenerationConfig(): MapGenerationConfig {
    const config = this.getConfig();
    const defaultConfig = this.getDefaultConfig();
    return {
      ...(defaultConfig.mapGeneration || {}),
      ...(config.mapGeneration || {}),
    } as MapGenerationConfig;
  }

  /**
   * Reset the configuration (for testing purposes)
   */
  public static resetConfig(): void {
    this.config = null;
  }
}
