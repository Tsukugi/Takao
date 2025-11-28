/**
 * Takao Engine Implementation - Main Integration Class
 * Interconnects all features: StoryTeller, Unit Controller, Maps, Gates, Rendering
 */

import { GameLoop } from './core/GameLoop';
import { StoryTeller } from './core/StoryTeller';
import { UnitController } from './ai/UnitController';
import { MapRenderer } from './utils/MapRenderer';
import { WorldManager } from './utils/WorldManager';
import { Position, World, type IUnitPosition } from '@atsu/choukai';
import { isUnitPosition } from './types/typeGuards';
import { MathUtils } from './utils/Math';

export class TakaoImpl {
  private gameLoop: GameLoop;
  private storyTeller: StoryTeller;
  private unitController: UnitController;
  private isRunning: boolean = false;

  constructor() {
    this.unitController = new UnitController();
    this.storyTeller = new StoryTeller(this.unitController);
    this.gameLoop = new GameLoop();
  }

  /**
   * Initialize the game with initial setup
   */
  public async initialize(): Promise<void> {
    console.log('Initializing Takao Engine...');

    // Initialize unit controller
    await this.unitController.initialize({ turn: 0 });

    // Create initial maps
    const mainMap = this.storyTeller.createMap('Main Continent', 50, 15);
    const forestMap = this.storyTeller.createMap('Dark Forest', 35, 10);
    const mountainMap = this.storyTeller.createMap('High Mountains', 42, 8);

    // Add maps to world
    const world = this.storyTeller.getWorld();
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

    // Set up the game loop with turn-by-turn execution
    this.gameLoop.start(async (turn: number) => {
      await this.runTurn(turn);

      // Stop after 15 turns for demonstration
      if (turn >= 15) {
        this.stop();
        console.log('\nGame ended after 15 turns.');

        // Show final state
        this.showFinalState();
      }
    });

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
    this.gameLoop.stop();
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
