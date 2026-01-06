// Shared configuration types and helpers for engine setup.

export interface AppConfig {
  /** Max turns before stopping the session unless runIndefinitely is true. */
  maxTurnsPerSession: number;
  /** When true, ignores maxTurnsPerSession and keeps running. */
  runIndefinitely?: boolean;
  /** Restrict available actions to this allowlist (matches action.type). */
  overrideAvailableActions?: string[];
  /** Turns a unit must wait between actions; defaults to 1 when omitted. */
  cooldownPeriod?: number;
  /** When true, clears saved units before the engine initializes. */
  clearUnitsOnStart?: boolean;
}

export interface MapGenerationConfig {
  // Map dimensions settings
  /** Default width for generated maps when no width is provided. */
  defaultMapWidth: number;
  /** Default height for generated maps when no height is provided. */
  defaultMapHeight: number;

  // Terrain frequency settings (0-1 probability)
  /** Frequency multiplier for water bodies. */
  waterFrequency: number;
  /** Frequency multiplier for mountain ranges. */
  mountainFrequency: number;
  /** Frequency multiplier for forest areas. */
  forestFrequency: number;
  /** Frequency multiplier for desert areas. */
  desertFrequency: number;
  /** Frequency multiplier for roads. */
  roadFrequency: number;
  /** Frequency multiplier for swamp areas. */
  swampFrequency: number;
  /** Frequency multiplier for snow areas. */
  snowFrequency: number;
  /** Frequency multiplier for sand areas. */
  sandFrequency: number;

  // Feature generation settings
  /** Minimum water body size (square dimension). */
  minWaterBodySize: number;
  /** Maximum water body size (square dimension). */
  maxWaterBodySize: number;
  /** Minimum mountain range length. */
  minMountainRangeLength: number;
  /** Maximum mountain range length. */
  maxMountainRangeLength: number;
  /** Minimum forest area size (square dimension). */
  minForestAreaSize: number;
  /** Maximum forest area size (square dimension). */
  maxForestAreaSize: number;
  /** Minimum spacing between terrain features. */
  minTerrainFeatureSpacing: number;

  // Unit placement settings
  /** Preferred terrain types when placing units. */
  unitSpawnNearTerrain: string[];
  /** Minimum distance between initial unit spawns. */
  minDistanceBetweenUnits: number;

  // Map connection settings
  /** When true, generate connecting roads between maps. */
  createRoadsBetweenMaps: boolean;
  /** Maximum number of maps in the generated world. */
  maxMapsInWorld: number;

  // Procedural generation settings
  /** Enables perlin-based generation if implemented. */
  enablePerlinNoise: boolean;
  /** Scale used for perlin noise if enabled. */
  noiseScale: number;
  /** Seed string for deterministic generation. */
  seed: string;
}

export interface MayaRenderingConfig {
  /** When true, hides non-visual overlays like unit positions. */
  visualOnly: boolean;
  /** Show the action diary panel. */
  showDiary?: boolean;
  /** Max visible diary height in rows. */
  diaryMaxHeight?: number;
  /** Max number of diary entries to display. */
  diaryMaxEntries?: number;
  /** Title for the diary panel. */
  diaryTitle?: string;
  /** Show the console log panel. */
  showConsole?: boolean;
  /** Max visible console height in rows. */
  consoleMaxHeight?: number;
  /** Max number of console entries to keep. */
  consoleMaxEntries?: number;
  /** Title for the console panel. */
  consoleTitle?: string;
}

export interface FullConfig extends AppConfig {
  /** Override values for map generation; omitted fields fall back to defaults. */
  mapGeneration?: Partial<MapGenerationConfig>;
  /** Rendering settings consumed by Maya and logger configuration. */
  rendering: MayaRenderingConfig;
}

export const defineEngineConfig = (config: FullConfig): FullConfig => config;
