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
    const mainMap = this.storyTeller.createMap('Main Continent', 20, 15);
    const forestMap = this.storyTeller.createMap('Dark Forest', 15, 10);
    const mountainMap = this.storyTeller.createMap('High Mountains', 12, 8);

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

    // Generate story action using the storyteller
    const storyAction = await this.storyTeller.generateStoryAction(turn);
    console.log(`Story Action: ${storyAction.action.description}`);
    console.log(`Narrative: Turn ${turn}: ${storyAction.action.description}`);

    // Render the current state of all maps
    console.log('\nCurrent Map State:');
    const world = this.storyTeller.getWorld();
    const maps = world.getAllMaps();

    for (const map of maps) {
      console.log(MapRenderer.renderCompact(map));
      console.log('');
    }

    // Show unit positions (retrieved from unit properties rather than world)
    console.log('Unit Positions:');
    const allUnits = this.unitController.getUnits();

    for (const unit of allUnits) {
      // Try to get position from the unit's own properties first
      const unitPosition = unit.getPropertyValue('position');
      if (unitPosition && isUnitPosition(unitPosition)) {
        // Position is in IUnitPosition format: {unitId, mapId, position: Position}
        console.log(
          `  ${unit.name} (${unit.id.substring(0, 8)}...) is at ${unitPosition.mapId} (${unitPosition.position.x}, ${unitPosition.position.y})`
        );
      } else {
        // If unit doesn't have position property, check world position
        try {
          const worldPosition = world.getUnitPosition(unit.id);
          if (worldPosition) {
            console.log(
              `  ${unit.name} (${unit.id.substring(0, 8)}...) is at ${worldPosition.mapId} (${worldPosition.position.x}, ${worldPosition.position.y})`
            );
          } else {
            console.log(
              `  ${unit.name} (${unit.id.substring(0, 8)}...) position not set`
            );
          }
        } catch {
          console.log(
            `  ${unit.name} (${unit.id.substring(0, 8)}...) not in world yet`
          );
        }
      }
    }

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

    // Show final map rendering
    console.log('\nFinal Map State:');
    const world = this.storyTeller.getWorld();
    const maps = world.getAllMaps();

    for (const map of maps) {
      console.log(MapRenderer.renderCompact(map));
      console.log('');
    }

    // Show final unit positions (retrieved from unit properties rather than world)
    console.log('Final Unit Positions:');
    const allUnits = this.unitController.getUnits();

    for (const unit of allUnits) {
      // Try to get position from the unit's own properties first
      const unitPosition = unit.getPropertyValue('position');
      if (unitPosition && isUnitPosition(unitPosition)) {
        // Position is in IUnitPosition format: {unitId, mapId, position: Position}
        console.log(
          `  ${unit.name} (${unit.id.substring(0, 8)}...) is at ${unitPosition.mapId} (${unitPosition.position.x}, ${unitPosition.position.y})`
        );
      } else {
        // If unit doesn't have position property, check world position
        try {
          const worldPosition = world.getUnitPosition(unit.id);
          if (worldPosition) {
            console.log(
              `  ${unit.name} (${unit.id.substring(0, 8)}...) is at ${worldPosition.mapId} (${worldPosition.position.x}, ${worldPosition.position.y})`
            );
          } else {
            console.log(
              `  ${unit.name} (${unit.id.substring(0, 8)}...) position not set`
            );
          }
        } catch {
          console.log(
            `  ${unit.name} (${unit.id.substring(0, 8)}...) not in world yet`
          );
        }
      }
    }

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
