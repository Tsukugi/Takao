/**
 * Takao Engine Implementation - Main Integration Class
 * Interconnects all features: StoryTeller, Unit Controller, Maps, Gates, Rendering
 * Uses GameEngine internally for turn management and world saving
 */

import { renderGame } from '@atsu/maya';
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
  private logger: Logger;
  private isRunning: boolean = false;

  constructor() {
    this.logger = new Logger({ prefix: 'TakaoImpl' });
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
    this.logger.info('Initializing Takao Engine...');

    // Initialize the underlying game engine
    await this.gameEngine.initialize({ turn: 0 });

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

    this.logger.info('Takao Engine initialized with maps, gates, and units.');
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

  /**
   * Run a single turn of the game
   */
  public async runTurn(): Promise<void> {
    // Get all units
    const allUnits = this.unitController.getUnits();
    const world = this.storyTeller.getWorld();
    const allMaps = world.getAllMaps();
    const isVisualOnlyMode = this.gameEngine.getConfig().rendering.visualOnly;

    // Then, ensure each unit moves - process each unit directly
    for (const unit of allUnits) {
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

    try {
      // Prepare units mapping for Maya rendering
      const unitsMap: Record<string, BaseUnit> = {};
      for (const unit of allUnits) {
        unitsMap[unit.id] = unit;
      }

      // Render the game using Maya, showing only the first map
      const firstMap = allMaps[0];
      await renderGame(world, unitsMap, {
        selectedMap: firstMap?.name,
        showUnitPositions: !isVisualOnlyMode,
      });
    } catch {
      this.logger.error('\nNo maps to render.');
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

    // Start the underlying game engine instead of managing our own loop
    this.gameEngine.start();
    this.logger.info('Game started! Running...');
  }

  /**
   * Stop the game loop
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop the underlying game engine
    this.gameEngine.stop();

    this.logger.info('Game stopped.');
  }

  /**
   * Show the final state of the game
   */
  private showFinalState(): void {
    this.logger.info('\nFinal Game State:');

    // Show final map rendering with fixed display
    this.logger.info('\nFinal Map State:');
    const world = this.storyTeller.getWorld();
    const maps = world.getAllMaps();
    const allUnits = this.unitController.getUnits();

    // Using Maya for rendering the final state
    // Prepare units mapping for Maya rendering
    const unitsMap: Record<string, BaseUnit> = {};
    for (const unit of allUnits) {
      unitsMap[unit.id] = unit;
    }

    const isVisualOnlyMode = this.gameEngine.getConfig().rendering.visualOnly;
    // Render the game using Maya, showing only the first map
    try {
      const firstMap = maps[0];
      renderGame(world, unitsMap, {
        selectedMap: firstMap?.name,
        showUnitPositions: !isVisualOnlyMode,
      });
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
  }

  private createInitialMaps(world: World): void {
    this.logger.info('No existing maps found, creating initial maps...');

    // Create initial maps since none exist
    const mainMap = this.storyTeller.createMap('Main Continent', 100, 50);
    const forestMap = this.storyTeller.createMap('Dark Forest', 100, 100);
    const mountainMap = this.storyTeller.createMap('High Mountains', 100, 80);

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
}
