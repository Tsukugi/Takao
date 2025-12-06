/**
 * Takao Engine Implementation - Main Integration Class
 * Interconnects all features: StoryTeller, Unit Controller, Maps, Gates, Rendering
 * Uses GameEngine internally for turn management and world saving
 */

import { renderGame, type IGameRendererConfig } from '@atsu/maya';
import { World, Position } from '@atsu/choukai';
import type { BaseUnit, IUnitPosition } from '@atsu/atago';
import { GameEngine } from './core/GameEngine';
import { StoryTeller } from './core/StoryTeller';
import { UnitController } from './ai/UnitController';
import { Logger } from './utils/Logger';
import { isUnitPosition } from './types/typeGuards';
import { MathUtils } from './utils/Math';

export class TakaoImpl {
  private gameEngine: GameEngine;
  private logger: Logger = new Logger({ prefix: 'TakaoImpl', disable: false });
  private isRunning: boolean = false;

  constructor() {
    this.gameEngine = new GameEngine({
      onTurnStart: this.runTurn.bind(this),
      onStop: this.showFinalState.bind(this),
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
  private lastWorldState: {
    world: World;
    units: Map<string, BaseUnit>;
  } | null = null; // Used in runTurn method
  private renderConfig: IGameRendererConfig = {};
  private _lastWorldHash: string | null = null;
  private inputHandler: ((data: Buffer) => void) | null = null;
  private stdinRawMode = false;

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
    const isVisualOnlyMode = this.gameEngine.getConfig().rendering.visualOnly;

    // Get current turn for cooldown calculation
    const currentTurn = this.gameEngine.getCurrentTurn();

    // Get cooldown period from config
    const cooldownPeriod = this.gameEngine.getCooldownPeriod();

    // Filter units by cooldown - only move units that are not in cooldown
    const aliveUnits = allUnits.filter(unit => {
      const statusProperty = unit.getPropertyValue('status');
      return !(statusProperty && statusProperty.value === 'dead');
    });

    // Filter units by cooldown - units can only move once every few turns
    // Only units that have completed their cooldown can move
    const unitsToMove = aliveUnits.filter(unit => {
      const lastTurnProperty = unit.getPropertyValue('lastActionTurn');
      const lastTurn = lastTurnProperty ? lastTurnProperty.value : -Infinity;
      return currentTurn - lastTurn >= cooldownPeriod;
    });

    // If no units are available due to cooldown, use all alive units (reset cooldowns)
    const unitsForMovement = unitsToMove.length > 0 ? unitsToMove : aliveUnits;

    // Move only eligible units - process each unit directly
    for (const unit of unitsForMovement) {
      try {
        // Get the unit's current position directly
        const unitPos = unit.getPropertyValue<IUnitPosition>('position');
        if (!unitPos) continue; // Skip units without position

        // Simple movement: move one step in a random direction
        const directions = [
          { x: 0, y: -1 }, // North
          { x: 1, y: 0 }, // East
          { x: 0, y: 1 }, // South
          { x: -1, y: 0 }, // West
        ];

        // Select a random direction
        const randomDirection = MathUtils.getRandomFromArray(directions);
        // Get map dimensions to properly constrain movement
        const currentMap = world.getMap(unitPos.mapId);
        const maxX = currentMap ? currentMap.width - 1 : 19;
        const maxY = currentMap ? currentMap.height - 1 : 14;

        const newX = Math.max(
          0,
          Math.min(unitPos.position.x + randomDirection.x, maxX)
        );
        const newY = Math.max(
          0,
          Math.min(unitPos.position.y + randomDirection.y, maxY)
        );

        // Update position directly on the unit using its property
        const newPosition = new Position(newX, newY, unitPos.position.z);
        const newUnitPosition: IUnitPosition = {
          unitId: unit.id,
          mapId: unitPos.mapId,
          position: newPosition,
        };
        unit.setProperty('position', newUnitPosition);
        const moved = true; // Movement always succeeds when setting property directly

        if (!isVisualOnlyMode) {
          if (moved) {
            this.logger.info(`${unit.name} moves to (${newX}, ${newY})`);
          } else {
            this.logger.info(`${unit.name} failed to move`);
          }
        }
      } catch (error) {
        if (!isVisualOnlyMode)
          this.logger.info(
            `${unit.name} could not move: ${(error as Error).message}`
          );
      }
    }

    // Store the current world state for rendering (always update with all units)
    const unitsMap = new Map<string, BaseUnit>();
    for (const unit of allUnits) {
      unitsMap.set(unit.id, unit);
    }

    // Always update the world state for rendering to ensure all units are displayed
    this.lastWorldState = {
      world,
      units: unitsMap,
    };

    this.renderConfig = {
      selectedMap: allMaps[0]?.name,
      showUnitPositions: !isVisualOnlyMode,
    };

    // Generate hash to determine if state has changed for optimization
    this.lastWorldHash = this.generateWorldHash(world, unitsMap);
  }

  private startRenderer(): void {
    if (this.isRendererRunning) {
      return;
    }

    this.isRendererRunning = true;

    this.rendererIntervalId = setInterval(() => {
      // Always get fresh units from the controller to ensure we have all units
      const allUnits = this.unitController.getUnits();
      const world = this.storyTeller.getWorld();

      // Create a fresh units mapping to ensure all units are included
      const unitsMap: Record<string, BaseUnit> = {};
      for (const unit of allUnits) {
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

    // Listen for ESC to exit when running in a TTY
    this.attachEscapeHandler();

    // Start the underlying game engine for game logic
    this.gameEngine.start();
    this.logger.info('Game started! Running...');
  }

  /**
   * Stop the game loop
   */
  public stop(): void {
    this.isRunning = false;

    // Remove key handler if attached
    this.detachEscapeHandler();

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
   * Attach an ESC key handler for graceful shutdown in TTY environments
   */
  private attachEscapeHandler(): void {
    if (typeof process === 'undefined') return;
    const stdin = process.stdin;
    if (!stdin || !stdin.isTTY) return;

    try {
      stdin.setRawMode?.(true);
      stdin.resume();
      this.stdinRawMode = true;
    } catch {
      return;
    }

    this.inputHandler = (data: Buffer) => {
      const key = data.toString();
      if (key === '\u001b') {
        this.logger.info('ESC pressed, stopping game...');
        this.stop();
      }
    };

    stdin.on('data', this.inputHandler);
  }

  /**
   * Detach ESC key handler and restore stdin state
   */
  private detachEscapeHandler(): void {
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
