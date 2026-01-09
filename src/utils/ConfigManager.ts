import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import type { FullConfig, MapGenerationConfig } from './engineConfig';

const require = createRequire(import.meta.url);
let tsNodeRegistered = false;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

interface TsNodeRegisterOptions {
  transpileOnly: boolean;
  compilerOptions: Record<string, unknown>;
  moduleTypes?: Record<string, 'cjs' | 'esm' | 'package'>;
}

const hasRegister = (
  value: unknown
): value is {
  register: (options: TsNodeRegisterOptions) => void;
} => isRecord(value) && typeof value.register === 'function';

const registerTsNode = (): void => {
  if (tsNodeRegistered) {
    return;
  }

  try {
    const tsNodeModule: unknown = require('ts-node');
    if (!hasRegister(tsNodeModule)) {
      throw new Error('ts-node does not expose a register function');
    }
    const registerOptions: TsNodeRegisterOptions = {
      transpileOnly: true,
      compilerOptions: {
        module: 'CommonJS',
        moduleResolution: 'node',
      },
      moduleTypes: {
        '**/engine.config.ts': 'cjs',
      },
    };
    tsNodeModule.register(registerOptions);
    tsNodeRegistered = true;
  } catch (error) {
    console.warn('ts-node is required to load engine.config.ts', error);
  }
};

const isFullConfig = (value: unknown): value is FullConfig => {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.maxTurnsPerSession !== 'number') {
    return false;
  }

  if (
    value.manualTurnMode !== undefined &&
    typeof value.manualTurnMode !== 'boolean'
  ) {
    return false;
  }

  if (
    value.defaultMovementRange !== undefined &&
    typeof value.defaultMovementRange !== 'number'
  ) {
    return false;
  }

  if (
    value.placementMapName !== undefined &&
    typeof value.placementMapName !== 'string'
  ) {
    return false;
  }

  if (
    value.movementStepDelayMs !== undefined &&
    typeof value.movementStepDelayMs !== 'number'
  ) {
    return false;
  }
  if (
    value.movementStepCooldownMs !== undefined &&
    typeof value.movementStepCooldownMs !== 'number'
  ) {
    return false;
  }

  if (!isRecord(value.rendering)) {
    return false;
  }

  if (typeof value.rendering.visualOnly !== 'boolean') {
    return false;
  }

  if (value.mapGeneration !== undefined && !isRecord(value.mapGeneration)) {
    return false;
  }

  return true;
};

export class ConfigManager {
  private static config: FullConfig | null = null;

  /**
   * Load the configuration from engine.config.ts
   */
  public static loadConfig(): FullConfig {
    if (this.config) {
      return this.config;
    }

    // Try to load from config file in data directory
    const configPath = path.resolve('data', 'engine.config.ts');

    if (fs.existsSync(configPath)) {
      try {
        registerTsNode();
        const configModule: unknown = require(configPath);
        const configCandidate =
          isRecord(configModule) && 'default' in configModule
            ? configModule.default
            : configModule;
        if (!isFullConfig(configCandidate)) {
          throw new Error('engine.config.ts does not export a valid config');
        }
        this.config = configCandidate;
      } catch (error) {
        console.warn('Invalid engine.config.ts format, using defaults:', error);
        this.config = this.getDefaultConfig();
      }
    } else {
      console.warn('engine.config.ts not found, using defaults');
      this.config = this.getDefaultConfig();
    }

    return this.config;
  }

  public static getDefaultConfig(): FullConfig {
    return {
      maxTurnsPerSession: 10,
      runIndefinitely: false,
      manualTurnMode: true,
      cooldownPeriod: 1, // Default: every unit can act each turn (current behavior)
      clearUnitsOnStart: false,
      defaultMovementRange: 1,
      movementStepCooldownMs: 300,
      placementMapName: 'Main Continent',
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
        showDiary: true, // Default to showing diary
        diaryMaxHeight: 30, // Default diary height
        diaryMaxEntries: 20, // Default max entries to show
        diaryTitle: 'Action Diary', // Default diary title
        showConsole: true,
        consoleMaxHeight: 12,
        consoleMaxEntries: 200,
        consoleTitle: 'Console Log',
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
    const configPath = path.resolve('data', 'engine.config.ts');
    if (fs.existsSync(configPath)) {
      const resolvedPath = require.resolve(configPath);
      delete require.cache[resolvedPath];
    }
  }
}

export type {
  FullConfig,
  MapGenerationConfig,
  MayaRenderingConfig,
} from './engineConfig';
