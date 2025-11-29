/**
 * Takao Engine Implementation - Main Integration Class
 * Interconnects all features: StoryTeller, Unit Controller, Maps, Gates, Rendering
 * Uses GameEngine internally for turn management and world saving
 */

import { GameEngine } from './core/GameEngine';
import { StoryTeller } from './core/StoryTeller';
import { UnitController } from './ai/UnitController';
import { MapRenderer } from './utils/MapRenderer';
import { WorldManager } from './utils/WorldManager';
import { Position, World, type IUnitPosition } from '@atsu/choukai';
import { isUnitPosition } from './types/typeGuards';
import { MathUtils } from './utils/Math';

export class TakaoImpl {
  private gameEngine: GameEngine;
  private isRunning: boolean = false;

  constructor() {
    this.gameEngine = new GameEngine({ onTurnStart: this.runTurn.bind(this) });
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
    console.log('Initializing Takao Engine...');

    // Initialize the underlying game engine
    await this.gameEngine.initialize({ turn: 0 });

    // Get the world instance
    const world = this.storyTeller.getWorld();

    // Check if there are already saved maps in the world
    const existingMaps = world.getAllMaps();

    if (existingMaps.length === 0) {
      console.log('No existing maps found, creating initial maps...');

      // Create initial maps since none exist
      const mainMap = this.storyTeller.createMap('Main Continent', 200, 150);
      const forestMap = this.storyTeller.createMap('Dark Forest', 350, 100);
      const mountainMap = this.storyTeller.createMap('High Mountains', 420, 80);

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

      console.log('Initial maps and gates created.');
    } else {
      console.log(
        `Found ${existingMaps.length} existing maps from saved state, skipping initial map creation.`
      );
    }

    // Place some initial units on the maps based on configuration
    this.initializeUnitPositions(world);

    console.log('Takao Engine initialized with maps, gates, and units.');
  }

  /**
   * Initialize unit positions based on configuration data
   */
  private initializeUnitPositions(world: World): void {
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
      const unitPosition = unit.getPropertyValue('position');

      if (unitPosition && isUnitPosition(unitPosition)) {
        // If position exists in IUnitPosition format, use it
        WorldManager.setUnitPosition(
          world,
          unit.id,
          unitPosition.mapId,
          unitPosition.position
        );
      } else if (unitPosition) {
        // Fallback for other position formats
        WorldManager.setUnitPosition(
          world,
          unit.id,
          unitPosition.mapId || 'Main Continent',
          new Position(unitPosition.x, unitPosition.y)
        );
      } else {
        WorldManager.setUnitPosition(
          world,
          unit.id,
          defaultPosition.mapId,
          defaultPosition.position
        );

        // Set the position as a property of the unit for future reference
        unit.setProperty('position', defaultPosition);
      }
    }
  }

  /**
   * Run a single turn of the game
   */
  public async runTurn(turn: number): Promise<void> {
    console.log(`\n--- Turn ${turn} ---`);

    // Get all units
    const allUnits = this.unitController.getUnits();
    const world = this.storyTeller.getWorld();

    // Each turn: every unit gets one action and one movement
    // First, generate story actions for the turn (number of actions = number of units)
    for (let i = 0; i < allUnits.length; i++) {
      const storyAction = await this.storyTeller.generateStoryAction(turn);
      console.log(`Action ${i + 1}: ${storyAction.action.description}`);
    }

    // Then, ensure each unit moves
    for (const unit of allUnits) {
      try {
        const unitPos = world.getUnitPosition(unit.id);
        if (unitPos) {
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

          const moved = await this.storyTeller.moveUnitToPosition(
            unit.id,
            newX,
            newY
          );
          if (moved) {
            console.log(`${unit.name} moves to (${newX}, ${newY})`);
          } else {
            console.log(`${unit.name} failed to move`);
          }
        }
      } catch (error) {
        console.log(`${unit.name} could not move: ${(error as Error).message}`);
      }
    }

    // Render the current state of all maps using fixed display
    const maps = world.getAllMaps();

    // Create mapping from unit ID to unit name for rendering
    const unitNameMap: Record<string, string> = {};
    for (const unit of allUnits) {
      unitNameMap[unit.id] = unit.name;
    }

    // Create mapping from unit ID to position information
    const unitPositionMap: Record<string, IUnitPosition> = {};
    for (const unit of allUnits) {
      // Try to get position from the unit's own properties first
      const unitPosition = unit.getPropertyValue('position');
      if (unitPosition && isUnitPosition(unitPosition)) {
        // Position is in IUnitPosition format: {unitId, mapId, position: Position}
        unitPositionMap[unit.id] = {
          unitId: unit.id,
          mapId: unitPosition.mapId,
          position: unitPosition.position,
        };
      } else {
        // If unit doesn't have position property, check world position
        try {
          const worldPosition = world.getUnitPosition(unit.id);
          if (worldPosition) {
            unitPositionMap[unit.id] = {
              unitId: unit.id,
              mapId: worldPosition.mapId,
              position: worldPosition.position,
            };
          }
        } catch {
          // If position is not found, we'll skip adding it to the map
        }
      }
    }

    // Using fixed display for all maps together with unit positions
    MapRenderer.renderMultipleMapsFixed(maps, unitNameMap, unitPositionMap);

    console.log('\n' + '='.repeat(50));
  }

  /**
   * Start the game loop
   */
  public start(): void {
    if (this.isRunning) {
      console.log('Game is already running');
      return;
    }

    this.isRunning = true;

    // Start the underlying game engine instead of managing our own loop
    this.gameEngine.start();
    console.log('Game started! Running...');
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

    console.log('Game stopped.');
  }

  /**
   * Show the final state of the game
   */
  private showFinalState(): void {
    console.log('\nFinal Game State:');

    // Show final map rendering with fixed display
    console.log('\nFinal Map State:');
    const world = this.storyTeller.getWorld();
    const maps = world.getAllMaps();
    const allUnits = this.unitController.getUnits();

    // Create mapping from unit ID to unit name for rendering
    const unitNameMap: Record<string, string> = {};
    for (const unit of allUnits) {
      unitNameMap[unit.id] = unit.name;
    }

    // Create mapping from unit ID to position information
    const unitPositionMap: Record<string, IUnitPosition> = {};
    for (const unit of allUnits) {
      // Try to get position from the unit's own properties first
      const unitPosition = unit.getPropertyValue('position');
      if (unitPosition && isUnitPosition(unitPosition)) {
        // Position is in IUnitPosition format: {unitId, mapId, position: Position}
        unitPositionMap[unit.id] = {
          unitId: unit.id,
          mapId: unitPosition.mapId,
          position: unitPosition.position,
        };
      } else {
        // If unit doesn't have position property, check world position
        try {
          const worldPosition = world.getUnitPosition(unit.id);
          if (worldPosition) {
            unitPositionMap[unit.id] = {
              unitId: unit.id,
              mapId: worldPosition.mapId,
              position: worldPosition.position,
            };
          }
        } catch {
          // If position is not found, we'll skip adding it to the map
        }
      }
    }

    // Using fixed display for all maps together with unit positions
    MapRenderer.renderMultipleMapsFixed(maps, unitNameMap, unitPositionMap);

    // Show gate connections
    console.log('\nGate Connections:');
    const allGates = this.storyTeller.getAllGates();
    for (const gate of allGates) {
      console.log(
        `  ${gate.name}: ${gate.mapFrom}(${gate.positionFrom.x},${gate.positionFrom.y}) <-> ${gate.mapTo}(${gate.positionTo.x},${gate.positionTo.y})`
      );
    }
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
