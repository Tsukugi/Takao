/**
 * Takao Engine Implementation - Main Integration Class
 * Interconnects all features: StoryTeller, Unit Controller, Maps, Gates, Rendering
 * Uses GameEngine internally for turn management and world saving
 */

import { renderGame, type IGameRendererConfig } from '@atsu/maya';
import { World, Position, Map as ChoukaiMap } from '@atsu/choukai';
import type { BaseUnit, IUnitPosition } from '@atsu/atago';
import { GameEngine } from './core/GameEngine';
import { StoryTeller } from './core/StoryTeller';
import { UnitController } from './ai/UnitController';
import { Logger } from './utils/Logger';
import { isUnitPosition } from './types/typeGuards';
import type { Action, ActionPayload, DiaryEntry } from './types';

export class TakaoImpl {
  private gameEngine: GameEngine;
  private logger: Logger = new Logger({ prefix: 'TakaoImpl', disable: false });
  private isRunning: boolean = false;
  private processedDeadUnits: Set<string> = new Set();
  private lastDiaryIndex: number = 0;

  constructor() {
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

  /**
   * Initialize the game with initial setup
   */
  public async initialize(): Promise<void> {
    // Initialize the underlying game engine
    await this.gameEngine.initialize({ turn: 0 });
    this.logger.info('Initializing Takao Engine...');
    this.logger = new Logger({
      prefix: 'TakaoImpl',
      disable: this.gameEngine.getConfig().rendering.visualOnly,
    });
    // Get the world instance
    const world = this.storyTeller.getWorld();

    // Check if there are already saved maps in the world
    const existingMaps = world.getAllMaps();

    if (existingMaps.length === 0) {
      this.createInitialMaps(world);
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

    // Place units based on their own position properties or defaults
    for (const unit of allUnits.values()) {
      // Define default positions for the first few units
      const defaultPosition: IUnitPosition = {
        unitId: unit.id,
        mapId: 'Main Continent',
        position: new Position(5, 5),
      };

      // Look for position in the unit's own properties first
      const unitPosition = unit.getPropertyValue<IUnitPosition>('position');

      if (unitPosition && isUnitPosition(unitPosition)) {
        // If position exists in IUnitPosition format, use it
        // Update the unit's position property with correct Position instance if needed
        const pos = unitPosition.position;
        const positionInstance =
          pos instanceof Position ? pos : new Position(pos.x, pos.y, pos.z);

        unit.setProperty('position', {
          unitId: unit.id,
          mapId: unitPosition.mapId,
          position: positionInstance,
        });
      } else {
        // Set the default position directly on the unit
        unit.setProperty('position', {
          unitId: unit.id,
          mapId: defaultPosition.mapId,
          position: new Position(
            defaultPosition.position.x,
            defaultPosition.position.y
          ),
        });
      }
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
  private inputHandler: ((data: Buffer) => void) | null = null;
  private stdinRawMode = false;
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
      const pos = unit.getPropertyValue<IUnitPosition>('position');
      if (pos) {
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

  private afterTurn(_turn: number): void {
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

    const newUnit = await this.unitController.addNewUnit();
    if (!newUnit) return;

    // Animals don't need unique names; override to a simple label
    newUnit.name = 'Wolf';
    newUnit.type = 'wolf';
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
        const statusProperty = unit.getPropertyValue('status');
        if (statusProperty && statusProperty.value === 'dead') continue;
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
      };

      try {
        renderGame(world, unitsMap, rendererConfig, diaryEntries);
      } catch {
        this.logger.error('\nNo maps to render.');
      }
    }, this.targetFrameTime);
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
          this.setNumericPropertyValue(
            killerUnit,
            'resources',
            currentResources + loot
          );
        }
      }

      this.unitController.removeUnit(defeatedUnit.id);
      this.processedDeadUnits.add(defeatedUnit.id);
    }
  }

  private getTargetIdFromAction(action: Action): string | null {
    const payload = action.payload as ActionPayload | undefined;
    const target =
      payload?.targetUnit ||
      payload?.target ||
      (payload as any)?.targetUnitId ||
      (payload as any)?.unitId;
    return typeof target === 'string' ? target : null;
  }

  private isWildAnimal(unit: BaseUnit): boolean {
    const factionProperty = unit.getPropertyValue('faction');
    const faction =
      typeof factionProperty === 'string'
        ? factionProperty
        : factionProperty?.value;
    return faction === 'Wild Animals' || unit.type === 'wolf';
  }

  private isUnitDead(unit: BaseUnit): boolean {
    const health = unit.getPropertyValue('health');
    const status = unit.getPropertyValue('status');

    const healthValue =
      typeof health === 'number' ? health : (health as any)?.value;

    if (typeof healthValue === 'number' && healthValue <= 0) {
      return true;
    }

    const statusValue =
      typeof status === 'string' ? status : (status as any)?.value;

    return statusValue === 'dead';
  }

  private getNumericPropertyValue(unit: BaseUnit, property: string): number {
    const value = unit.getPropertyValue(property);
    if (typeof value === 'number') {
      return value;
    }

    if (value && typeof value === 'object' && 'value' in value) {
      const numeric = (value as { value: number }).value;
      return typeof numeric === 'number' ? numeric : 0;
    }

    return 0;
  }

  private setNumericPropertyValue(
    unit: BaseUnit,
    property: string,
    value: number
  ): void {
    const existing = unit.getPropertyValue(property);
    if (existing && typeof existing === 'object') {
      const baseValue =
        typeof (existing as any).baseValue === 'number'
          ? (existing as any).baseValue
          : value;
      unit.setProperty(property, {
        ...(existing as object),
        value,
        baseValue,
      });
      return;
    }

    unit.setProperty(property, value);
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

    // Listen for input to advance turns or exit; fall back to automatic turns if not available
    const hasInput = this.attachInputHandler();

    if (hasInput) {
      this.gameEngine.startManual();
      this.logger.info('Game started! Press Enter to play a turn, ESC to stop.');
    } else {
      this.gameEngine.start();
      this.logger.warn(
        'TTY input not available; running automatic turns instead of manual mode.'
      );
    }
  }

  /**
   * Stop the game loop
   */
  public stop(): void {
    if (!this.isRunning && !this.gameEngine.getRunning()) {
      return;
    }

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
      if (statusProperty && statusProperty.value === 'dead') continue;
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
      };

      renderGame(world, unitsMap, rendererConfig, diaryEntries);
    } catch {
      this.logger.error('\nNo maps to render.');
    }

    // Show gate connections
    this.logger.info('\nGate Connections:');
    const allGates = this.storyTeller.getAllGates();
    for (const gate of allGates) {
      this.logger.info(
        `  ${gate.name}: ${gate.mapFrom}(${gate.positionFrom.x},${gate.positionFrom.y}) <-> ${gate.mapTo}(${gate.positionTo.x},${gate.positionTo.y})`
      );
    }

    // Save the world state at the end
    this.storyTeller.saveWorld();
    this.logger.info('\nWorld saved to file.');
  }

  private createInitialMaps(world: World): void {
    this.logger.info('No existing maps found, creating initial maps...');

    // Create initial maps since none exist
    const mainMap = this.storyTeller.createMap('Main Continent', 80, 20);
    const forestMap = this.storyTeller.createMap('Dark Forest', 50, 20);
    const mountainMap = this.storyTeller.createMap('High Mountains', 40, 20);

    // Add maps to world
    world.addMap(mainMap);
    world.addMap(forestMap);
    world.addMap(mountainMap);

    // Create gate connections between maps
    this.storyTeller.addGate({
      mapFrom: 'Main Continent',
      positionFrom: { x: 0, y: 7 },
      mapTo: 'Dark Forest',
      positionTo: { x: 14, y: 5 },
      name: 'MainToForestGate',
      bidirectional: true,
    });

    this.storyTeller.addGate({
      mapFrom: 'Main Continent',
      positionFrom: { x: 19, y: 10 },
      mapTo: 'High Mountains',
      positionTo: { x: 0, y: 3 },
      name: 'MainToMountainGate',
      bidirectional: true,
    });

    this.logger.info('Initial maps and gates created.');
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
    return this.storyTeller.getWorld();
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
  private attachInputHandler(): boolean {
    if (typeof process === 'undefined') return false;
    const stdin = process.stdin;
    if (!stdin || !stdin.isTTY) return false;

    try {
      stdin.setRawMode?.(true);
      stdin.resume();
      this.stdinRawMode = true;
    } catch {
      return false;
    }

    this.inputHandler = (data: Buffer) => {
      const key = data.toString();
      if (key === '\u001b') {
        this.logger.info('ESC pressed, stopping game...');
        this.stop();
        return;
      }

      if (key === '\r' || key === '\n') {
        void this.handleManualTurnRequest();
      }
    };

    stdin.on('data', this.inputHandler);
    return true;
  }

  /**
   * Detach input handlers and restore stdin state
   */
  private detachInputHandler(): void {
    if (typeof process === 'undefined') return;
    const stdin = process.stdin;
    if (!stdin) return;

    if (this.inputHandler) {
      stdin.off('data', this.inputHandler);
      this.inputHandler = null;
    }

    if (this.stdinRawMode) {
      try {
        stdin.setRawMode?.(false);
        stdin.pause();
      } catch {
        // ignore cleanup errors
      }
      this.stdinRawMode = false;
    }
  }
}
