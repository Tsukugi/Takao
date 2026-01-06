# Engine Configuration

This document explains how Takao loads engine configuration, where it is used,
and how to customize it with type-safe TypeScript.

## Files
- `Takao/data/engine.config.ts`: local runtime config (ignored by git).
- `Takao/src/utils/engineConfig.ts`: config types and `defineEngineConfig` helper.
- `Takao/src/utils/ConfigManager.ts`: loader, defaults, and cache.

## How Config Loads
1. `ConfigManager.getConfig()` calls `loadConfig()` the first time it is used.
2. `loadConfig()` looks for `data/engine.config.ts`.
3. It registers `ts-node` and loads the module via `require`.
4. If the module exports a valid `FullConfig`, that config is cached.
5. If the file is missing or invalid, `getDefaultConfig()` is used instead.

Notes:
- The config is cached; changes require a restart or `ConfigManager.resetConfig()`.
- If `ts-node` is unavailable or the module is invalid, a warning is logged and
  defaults are used.

## Type-Safe Configuration
Use a typed config object for IntelliSense and type checking:

```ts
import type { FullConfig } from '../src/utils/engineConfig';

const config: FullConfig = {
  maxTurnsPerSession: 50,
  runIndefinitely: true,
  cooldownPeriod: 1,
  clearUnitsOnStart: false,
  mapGeneration: { defaultMapWidth: 25, defaultMapHeight: 25 },
  rendering: { visualOnly: false },
};

export default config;
```

Note: `defineEngineConfig` was removed; use a plain typed object instead.

## Defaults and Merging
- `ConfigManager.getDefaultConfig()` defines the fallback values.
- `ConfigManager.getMapGenerationConfig()` merges defaults with any overrides
  under `mapGeneration`.
- Other sections do not merge; they are used exactly as provided.

## Where Each Setting Is Used

### AppConfig
- `maxTurnsPerSession` and `runIndefinitely` are read by `GameEngine` to decide
  when to stop the loop.
- `cooldownPeriod` gates unit actions in `StoryTeller` and is exposed by
  `GameEngine.getCooldownPeriod()`.
- `overrideAvailableActions` restricts candidate actions in `StoryTeller`.
- `clearUnitsOnStart` clears saved units during `GameEngine.initialize()`.

### MapGenerationConfig
- `MapGenerator` reads `ConfigManager.getMapGenerationConfig()` on startup.
- Terrain frequency, feature sizing, and spacing values are used while
  generating procedural maps.
- `enablePerlinNoise`, `noiseScale`, and `seed` are defined for future use
  (the current generator does not consume them yet).

### MayaRenderingConfig
- `TakaoImpl` and `StoryTeller` use these fields to configure logging,
  console visibility, diary rendering, and visual-only mode.
- `rendering.visualOnly` controls whether unit positions are shown.

## Validation Rules
`ConfigManager` validates that:
- `maxTurnsPerSession` is a number.
- `rendering` exists and `rendering.visualOnly` is a boolean.
- `mapGeneration` (if provided) is an object.

If validation fails, defaults are used and a warning is logged.
