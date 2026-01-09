/**
 * Takao Engine Implementation - Main Integration Class
 * Interconnects all features: StoryTeller, Unit Controller, Maps, Gates, Rendering
 * Uses GameEngine internally for turn management and world saving
 */

import {
  renderGame,
  type IGameRendererConfig,
  type ConsoleEntry,
} from '@atsu/maya';
import { World, Position, Map as ChoukaiMap } from '@atsu/choukai';
import type { BaseUnit } from '@atsu/atago';
import { GameInputController, InputManager } from '@atsu/noshiro';
import { GameEngine } from './core/GameEngine';
import { StoryTeller } from './core/StoryTeller';
import { UnitController } from './ai/UnitController';
import { Logger, type LogEntry } from './utils/Logger';
import { MapGenerator } from './utils/MapGenerator';
import { isUnitPosition } from './types/typeGuards';
import type { Action, ActionPayload, DiaryEntry } from './types';
import { targetFromPayload } from './utils/TargetUtils';
import { ConfigManager } from './utils/ConfigManager';
import type { MovementStepUpdate } from './core/WorldManager';

export class TakaoImpl {
  private gameEngine: GameEngine;
  private logger: Logger = new Logger({ prefix: 'TakaoImpl', disable: false });
  private inputManager: InputManager = new InputManager({
    logger: this.logger,
  });
  private gameInputController: GameInputController = new GameInputController(
    this.inputManager
  );
  private isRunning: boolean = false;
  private processedDeadUnits: Set<string> = new Set();
  private lastDiaryIndex: number = 0;
  private consoleEntries: ConsoleEntry[] = [];
  private consoleEntryLimit: number = 200;

  constructor() {
    this.configureConsoleLogging();
    this.gameEngine = new GameEngine({
      onTurnStart: this.runTurn.bind(this),
      onTurnEnd: this.afterTurn.bind(this),
      onStop: this.handleEngineStop.bind(this),
    });
  }

  private get unitController(): UnitController {
    return this.gameEngine.getUnitController();
  }

  private get storyTeller(): StoryTeller {
    return this.gameEngine.getStoryTeller();
  }

  private configureConsoleLogging(): void {
    const renderingConfig = ConfigManager.getConfig().rendering;
    const showConsole = renderingConfig.showConsole !== false;
    this.consoleEntryLimit = renderingConfig.consoleMaxEntries ?? 200;

    if (showConsole) {
      Logger.setConsoleEnabled(false);
      Logger.setOutputHandler(entry => this.captureLogEntry(entry));
      return;
    }

    Logger.setConsoleEnabled(true);
    Logger.setOutputHandler(undefined);
  }

  private captureLogEntry(entry: LogEntry): void {
    const consoleEntry: ConsoleEntry = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      ...(entry.prefix ? { prefix: entry.prefix } : {}),
    };

    this.consoleEntries.push(consoleEntry);

    const overflow = this.consoleEntries.length - this.consoleEntryLimit;
    if (overflow > 0) {
      this.consoleEntries.splice(0, overflow);
    }
  }

  /**
   * Initialize the game with initial setup
   */
  public async initialize(): Promise<void> {
    this.configureConsoleLogging();
    // Initialize the underlying game engine
    await this.gameEngine.initialize({ turn: 0 });
    this.storyTeller.setMovementStepHandler(this.handleMovementStep.bind(this));
    this.logger.info('Initializing Takao Engine...');
    this.logger = new Logger({
      prefix: 'TakaoImpl',
      disable:
        this.gameEngine.getConfig().rendering.visualOnly &&
        this.gameEngine.getConfig().rendering.showConsole !== true,
    });
    this.inputManager = new InputManager({ logger: this.logger });
    this.gameInputController = new GameInputController(this.inputManager);
    // Get the world instance
    const world = this.storyTeller.getWorld();

    // Check if there are already saved maps in the world
    let existingMaps = world.getAllMaps();

    if (existingMaps.length === 0) {
      const shouldCreateMap = await this.inputManager.promptYesNo(
        'No maps available. Generate a default map now?',
        { defaultValue: false }
      );

      if (!shouldCreateMap) {
        throw new Error(
          'No maps available; please create or load maps before initializing TakaoImpl.'
        );
      }

      const mapGenerator = new MapGenerator();
      const mapName = 'Main Continent';
      const newMap = mapGenerator.generateMap(mapName);
      world.addMap(newMap);
      existingMaps = world.getAllMaps();
      this.logger.info(
        `Generated a new map "${mapName}" because none were available.`
      );

      // Persist immediately so subsequent runs can load the new map
      this.storyTeller.saveWorld();
    } else {
      this.logger.info(
        `Found ${existingMaps.length} existing maps from saved state, skipping initial map creation.`
      );
    }

    // Place some initial units on the maps based on configuration
    this.initializeUnitPositions();

    // Track existing diary entries and defeated units so we only process new ones
    this.lastDiaryIndex = this.storyTeller.getDiary().length;
    for (const unit of this.unitController.getUnits()) {
      if (this.isUnitDead(unit)) {
        this.processedDeadUnits.add(unit.id);
      }
    }

    // DEBUG: Check how many maps are in the world
    const finalMaps = world.getAllMaps();
    this.logger.info(
      `Takao Engine initialized with ${finalMaps.length} maps, gates, and units.`
    );
  }

  /**
   * Initialize unit positions based on configuration data
   */
  private initializeUnitPositions(): void {
    const allUnits = this.unitController.getUnits();
    if (allUnits.length === 0) {
      return;
    }

    const world = this.storyTeller.getWorld();
    const maps = world.getAllMaps();
    if (maps.length === 0) {
      throw new Error('No maps available to place units.');
    }

    const placementMapName = ConfigManager.getConfig().placementMapName;
    const placementMap = placementMapName
      ? world.getMap(placementMapName)
      : maps[0];
    if (!placementMap) {
      const name = placementMapName ?? '(unspecified)';
      throw new Error(`Map "${name}" not found; cannot place units.`);
    }

    const getRandomPosition = (map: ChoukaiMap): Position => {
      const x = Math.floor(Math.random() * map.width);
      const y = Math.floor(Math.random() * map.height);
      return new Position(x, y);
    };

    const isWithinMap = (map: ChoukaiMap, pos: { x: number; y: number }) =>
      pos.x >= 0 && pos.x < map.width && pos.y >= 0 && pos.y < map.height;

    const occupied = new Set<string>();
    const positionKey = (mapId: string, pos: { x: number; y: number }) =>
      `${mapId}:${pos.x},${pos.y}`;

    const assertWalkable = (map: ChoukaiMap, pos: Position, unitId: string) => {
      if (!isWithinMap(map, pos)) {
        throw new Error(
          `Position (${pos.x}, ${pos.y}) for unit ${unitId} is outside map ${map.name}.`
        );
      }
      if (!map.isWalkable(pos.x, pos.y)) {
        throw new Error(
          `Position (${pos.x}, ${pos.y}) for unit ${unitId} is not walkable on map ${map.name}.`
        );
      }
      const key = positionKey(map.name, pos);
      if (occupied.has(key)) {
        throw new Error(
          `Position (${pos.x}, ${pos.y}) on map ${map.name} is already occupied; cannot place unit ${unitId}.`
        );
      }
      occupied.add(key);
    };

    const placeAtRandomWalkable = (unit: BaseUnit) => {
      const maxAttempts = Math.max(
        placementMap.width * placementMap.height * 2,
        50
      );
      for (let i = 0; i < maxAttempts; i++) {
        const pos = getRandomPosition(placementMap);
        if (!placementMap.isWalkable(pos.x, pos.y)) {
          continue;
        }
        const key = positionKey(placementMap.name, pos);
        if (occupied.has(key)) {
          continue;
        }
        unit.setProperty('position', {
          unitId: unit.id,
          mapId: placementMap.name,
          position: pos,
        });
        occupied.add(key);
        return;
      }
      throw new Error(
        `Unable to place unit ${unit.id}; no walkable tiles available on map ${placementMap.name}.`
      );
    };

    for (const unit of allUnits.values()) {
      const unitPosition = unit.getPropertyValue('position');

      if (unitPosition && isUnitPosition(unitPosition)) {
        const map = world.getMap(unitPosition.mapId);
        if (!map) {
          throw new Error(
            `Map ${unitPosition.mapId} not found for unit ${unit.id}; cannot place unit.`
          );
        }
        const posValue = unitPosition.position;
        const pos =
          posValue instanceof Position
            ? posValue
            : new Position(posValue.x, posValue.y, posValue.z);
        assertWalkable(map, pos, unit.id);
        unit.setProperty('position', {
          unitId: unit.id,
          mapId: map.name,
          position: pos,
        });
        continue;
      }

      placeAtRandomWalkable(unit);
    }
  }

  private readonly targetFrameTime: number = 1000 / 1;
  private rendererIntervalId: NodeJS.Timeout | null = null;
  private isRendererRunning: boolean = false;
  // Reserved for future diffing of world state to avoid unnecessary renders
  private _lastWorldState: {
    world: World;
    units: Map<string, BaseUnit>;
  } | null = null;
  private renderConfig: IGameRendererConfig = {};
  private _lastWorldHash: string | null = null;
  private isTurnInProgress = false;

  /**
   * Generate a hash to determine if the world state has changed
   */
  private generateWorldHash(
    world: World,
    units: Map<string, BaseUnit>
  ): string {
    // Create a simple hash based on unit positions and map states
    const states: string[] = [];

    // Add map information
    const maps = world.getAllMaps();
    for (const map of maps) {
      states.push(`${map.name}:${map.width}x${map.height}`);
    }

    // Add unit positions
    for (const [id, unit] of units) {
      const pos = unit.getPropertyValue('position');
      if (isUnitPosition(pos)) {
        states.push(`${id}:${pos.mapId}:${pos.position.x},${pos.position.y}`);
      }
    }

    // Sort to ensure consistent order
    states.sort();
    return states.join('|');
  }

  /**
   * Run a single turn of the game
   */
  public async runTurn(): Promise<void> {
    // Get all units
    const allUnits = this.unitController.getUnits();
    const world = this.storyTeller.getWorld();
    const allMaps = world.getAllMaps();
    const currentTurn = this.gameEngine.getTurnManager().getCurrentTurn();

    // Store the current world state for rendering (always update with all units)
    const unitsMap = new Map<string, BaseUnit>();
    for (const unit of allUnits) {
      unitsMap.set(unit.id, unit);
    }

    // Track world snapshot; if unchanged, just refresh hash and skip extra logging
    const newWorldHash = this.generateWorldHash(world, unitsMap);
    const worldChanged = this._lastWorldHash !== newWorldHash;
    this._lastWorldHash = newWorldHash;
    this._lastWorldState = worldChanged
      ? { world, units: unitsMap }
      : this._lastWorldState;

    this.renderConfig = {
      selectedMap: allMaps[0]?.name,
      showUnitPositions: !this.gameEngine.getConfig().rendering.visualOnly,
    };

    // Periodic hostile spawns: every 10 turns, ensure at least 3 Wild Animals
    if (currentTurn > 0 && currentTurn % 10 === 0) {
      await this.maybeSpawnWildAnimals(allMaps, allUnits);
    }
  }

  private afterTurn(turn: number): void {
    void turn; // turn number currently unused but preserved for future hooks
    const newEntries = this.getNewDiaryEntries();
    if (newEntries.length === 0) return;

    this.handleNewDiaryEntries(newEntries);
  }

  /**
   * Spawn a wolf with faction Wild Animals if below threshold.
   */
  private async maybeSpawnWildAnimals(
    allMaps: ChoukaiMap[],
    units: BaseUnit[]
  ): Promise<void> {
    if (allMaps.length === 0) {
      this.logger.warn('No maps available; skipping wild animal spawn.');
      return;
    }

    const wildAnimalCount = units.filter(
      unit => unit.getPropertyValue('faction') === 'Wild Animals'
    ).length;

    if (wildAnimalCount >= 3) {
      return;
    }

    const newUnit = await this.unitController.addUnitFromBeastiary('wolf');
    newUnit.setProperty('faction', 'Wild Animals');

    // Relationships: mark as hostile toward all non-Wild Animals
    const relationships: Record<string, 'hostile'> = {};
    for (const unit of units) {
      const faction = unit.getPropertyValue('faction');
      if (faction !== 'Wild Animals') {
        relationships[unit.id] = 'hostile';
      }
    }
    newUnit.setProperty('relationships', relationships);

    // Place on main map (or first map) at a random valid position
    const targetMap =
      allMaps.find(map => map.name === 'Main Continent') ?? allMaps[0];
    if (!targetMap) {
      this.logger.warn('No map available to place spawned wolf.');
      return;
    }

    const x = Math.floor(Math.random() * targetMap.width);
    const y = Math.floor(Math.random() * targetMap.height);
    newUnit.setProperty('position', {
      unitId: newUnit.id,
      mapId: targetMap.name,
      position: new Position(x, y),
    });

    this.logger.info(
      `Spawned Wild Animals wolf (${newUnit.id}) at ${targetMap.name} (${x}, ${y})`
    );
  }

  private startRenderer(): void {
    if (this.isRendererRunning) {
      return;
    }

    this.isRendererRunning = true;

    this.rendererIntervalId = setInterval(() => {
      this.renderFrame();
    }, this.targetFrameTime);
  }

  private renderFrame(): void {
    const cachedState = this._lastWorldState;
    // Prefer the latest cached world snapshot from the game loop, fallback to live fetch
    const world = cachedState?.world ?? this.storyTeller.getWorld();
    const unitsList = cachedState?.units
      ? Array.from(cachedState.units.values())
      : this.unitController.getUnits();

    // Create a fresh units mapping to ensure all units are included
    const unitsMap: Record<string, BaseUnit> = {};
    for (const unit of unitsList) {
      // Only include units that are not dead
      const statusProperty = unit.getPropertyValue<string>('status');
      if (statusProperty === 'dead') continue;
      unitsMap[unit.id] = unit;
    }

    // Get diary entries from the StoryTeller
    const diaryEntries = this.storyTeller.getDiary();

    // Get configuration from ConfigManager
    const config = this.gameEngine.getConfig();

    // Render the game using Maya with the stored world state and diary
    // Prepare configuration object with proper handling of optional properties
    const rendererConfig = {
      ...this.renderConfig,
      ...(config.rendering.showDiary !== undefined && {
        showDiary: config.rendering.showDiary,
      }),
      ...(config.rendering.diaryMaxHeight !== undefined && {
        diaryMaxHeight: config.rendering.diaryMaxHeight,
      }),
      ...(config.rendering.diaryMaxEntries !== undefined && {
        diaryMaxEntries: config.rendering.diaryMaxEntries,
      }),
      ...(config.rendering.diaryTitle !== undefined && {
        diaryTitle: config.rendering.diaryTitle,
      }),
      ...(config.rendering.showConsole !== undefined && {
        showConsole: config.rendering.showConsole,
      }),
      ...(config.rendering.consoleMaxHeight !== undefined && {
        consoleMaxHeight: config.rendering.consoleMaxHeight,
      }),
      ...(config.rendering.consoleMaxEntries !== undefined && {
        consoleMaxEntries: config.rendering.consoleMaxEntries,
      }),
      ...(config.rendering.consoleTitle !== undefined && {
        consoleTitle: config.rendering.consoleTitle,
      }),
    };

    try {
      renderGame(
        world,
        unitsMap,
        rendererConfig,
        diaryEntries,
        this.consoleEntries
      );
    } catch {
      this.logger.error('\nNo maps to render.');
    }
  }

  private handleMovementStep(update: MovementStepUpdate): void {
    if (!this.isRendererRunning) {
      return;
    }

    if (this.renderConfig.showUnitPositions === undefined) {
      this.renderConfig.showUnitPositions =
        !this.gameEngine.getConfig().rendering.visualOnly;
    }

    this.renderConfig.selectedMap = update.mapId;
    this.renderFrame();
  }

  private stopRenderer(): void {
    if (this.rendererIntervalId) {
      clearInterval(this.rendererIntervalId);
      this.rendererIntervalId = null;
      this.isRendererRunning = false;
    }
  }

  private getNewDiaryEntries(): DiaryEntry[] {
    const diary = this.storyTeller.getDiary();
    const entries = diary.slice(this.lastDiaryIndex);
    this.lastDiaryIndex = diary.length;
    return entries;
  }

  private handleNewDiaryEntries(entries: DiaryEntry[]): void {
    const units = this.unitController.getUnits();

    for (const entry of entries) {
      const action = entry.action;
      const targetId = this.getTargetIdFromAction(action);

      if (!targetId) continue;

      const defeatedUnit = units.find(unit => unit.id === targetId);
      if (!defeatedUnit) continue;
      if (this.processedDeadUnits.has(defeatedUnit.id)) continue;
      if (!this.isUnitDead(defeatedUnit)) continue;
      if (!this.isWildAnimal(defeatedUnit)) continue;

      const killerUnit = units.find(unit => unit.id === action.player);

      if (killerUnit) {
        const loot = this.getNumericPropertyValue(defeatedUnit, 'resources');
        if (loot > 0) {
          const currentResources = this.getNumericPropertyValue(
            killerUnit,
            'resources'
          );
          killerUnit.setProperty('resources', currentResources + loot);
        }
      }

      this.unitController.removeUnit(defeatedUnit.id);
      this.processedDeadUnits.add(defeatedUnit.id);
    }
  }

  private getTargetIdFromAction(action: Action): string | null {
    return targetFromPayload(action.payload as ActionPayload | undefined);
  }

  private isWildAnimal(unit: BaseUnit): boolean {
    const faction = unit.getPropertyValue<string>('faction');
    if (!faction) return unit.type === 'beast';
    return faction === 'Wild Animals' || unit.type === 'beast';
  }

  private isUnitDead(unit: BaseUnit): boolean {
    const healthValue = unit.getPropertyValue<number>('health');
    const statusValue = unit.getPropertyValue<string>('status');

    if (!healthValue || healthValue <= 0) {
      return true;
    }

    return statusValue === 'dead';
  }

  private getNumericPropertyValue(unit: BaseUnit, property: string): number {
    const value = unit.getPropertyValue<number>(property);
    return value ?? 0;
  }

  private handleEngineStop(): void {
    this.isRunning = false;
    this.isTurnInProgress = false;
    this.detachInputHandler();
    this.showFinalState();
  }

  private async handleManualTurnRequest(): Promise<void> {
    if (!this.isRunning || this.isTurnInProgress) {
      return;
    }

    this.isTurnInProgress = true;
    try {
      await this.gameEngine.playTurn();
    } catch (error) {
      this.logger.error('Error while processing turn:', error);
      this.stop();
    } finally {
      this.isTurnInProgress = false;
    }
  }

  /**
   * Start the game loop
   */
  public start(): void {
    if (this.isRunning) {
      this.logger.info('Game is already running');
      return;
    }

    this.isRunning = true;

    // Start the separate renderer loop for Maya
    this.startRenderer();

    const config = this.gameEngine.getConfig();
    const manualTurnMode = config.manualTurnMode ?? true;

    // Listen for input to advance turns or exit. Even if input is unavailable,
    // keep manual mode enabled when configured to avoid unexpected auto-turns.
    const hasInput = this.attachInputHandler(manualTurnMode);

    if (manualTurnMode) {
      this.gameEngine.startManual();

      if (hasInput) {
        this.logger.info(
          'Game started! Press Enter to play a turn, ESC to stop.'
        );
      } else {
        this.logger.warn(
          'TTY input not available; staying paused in manual mode. Trigger turns programmatically if needed.'
        );
      }
      return;
    }

    this.gameEngine.start();
    if (hasInput) {
      this.logger.info('Game started in auto mode. Press ESC to stop.');
      return;
    }

    this.logger.info('Game started in auto mode.');
  }

  /**
   * Stop the game loop
   */
  public stop(): void {
    this.isTurnInProgress = false;
    this.isRunning = false;

    // Remove key handler if attached
    this.detachInputHandler();

    // Stop the renderer first
    this.stopRenderer();

    // Stop the underlying game engine
    this.gameEngine.stop();

    this.logger.info('Game stopped.');
  }

  /**
   * Show the final state of the game
   */
  private showFinalState(): void {
    this.logger.info('\nFinal Game State:');

    // Stop the separate renderer before showing final state
    this.stopRenderer();

    // Show final map rendering with fixed display
    this.logger.info('\nFinal Map State:');
    const world = this.storyTeller.getWorld();
    const maps = world.getAllMaps();
    const allUnits = this.unitController.getUnits();

    // Using Maya for rendering the final state
    // Prepare units mapping for Maya rendering - only include non-dead units
    const unitsMap: Record<string, BaseUnit> = {};
    for (const unit of allUnits) {
      // Only include units that are not dead
      const statusProperty = unit.getPropertyValue('status');
      if (statusProperty === 'dead') continue; // skip dead units
      unitsMap[unit.id] = unit;
    }

    // Get configuration from ConfigManager
    const config = this.gameEngine.getConfig();
    const isVisualOnlyMode = config.rendering.visualOnly;

    // Render the game using Maya, showing only the first map
    try {
      const firstMap = maps[0];
      const diaryEntries = this.storyTeller.getDiary();
      // Prepare configuration object with proper handling of optional properties
      const rendererConfig = {
        selectedMap: firstMap?.name,
        showUnitPositions: !isVisualOnlyMode,
        ...config.rendering,
      };

      renderGame(
        world,
        unitsMap,
        rendererConfig,
        diaryEntries,
        this.consoleEntries
      );
    } catch {
      this.logger.error('\nNo maps to render.');
    }

    // Show gate connections
    this.logger.info('\nGate Connections:');
    const allGates = this.storyTeller.getWorldManager().getAllGates();
    for (const gate of allGates) {
      this.logger.info(
        `  ${gate.name}: ${gate.mapFrom}(${gate.positionFrom.x},${gate.positionFrom.y}) <-> ${gate.mapTo}(${gate.positionTo.x},${gate.positionTo.y})`
      );
    }

    // Save the world state at the end
    this.storyTeller.saveWorld();
    this.logger.info('\nWorld saved to file.');
  }

  /**
   * Get the StoryTeller instance for direct access
   */
  public getStoryTeller(): StoryTeller {
    return this.storyTeller;
  }

  /**
   * Get the UnitController instance for direct access
   */
  public getUnitController(): UnitController {
    return this.unitController;
  }

  /**
   * Get the game's World instance for direct access
   */
  public getWorld(): World {
    const world = this.storyTeller.getWorld();

    if (world.getAllMaps().length === 0) {
      throw new Error('No maps available in the world.');
    }

    return world;
  }

  /**
   * Check if the game is currently running
   */
  public getRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Attach input handlers for Enter (advance turn) and ESC (exit) in TTY environments.
   */
  private attachInputHandler(enableManualAdvance: boolean): boolean {
    return this.gameInputController.attachManualControls({
      onExit: () => {
        this.logger.info('ESC pressed, stopping game...');
        this.stop();
      },
      onAdvance: () => {
        if (!enableManualAdvance) {
          return;
        }
        void this.handleManualTurnRequest();
      },
    });
  }

  /**
   * Detach input handlers and restore stdin state
   */
  private detachInputHandler(): void {
    this.gameInputController.detachManualControls();
  }
}
