/**
 * Game Loop Example with Map Rendering Display
 * Shows narrative generation from StoryTeller along with map rendering
 */

import { GameLoop } from '../src/core/GameLoop';
import { StoryTeller } from '../src/core/StoryTeller';
import { UnitController } from '../src/ai/UnitController';
import { MapRenderer } from '../src/utils/MapRenderer';
import { WorldManager } from '../src/utils/WorldManager';
import { Position } from '@atsu/choukai';

async function runGameLoopWithMapRendering() {
  console.log('Takao Engine - Game Loop with Map Rendering');
  console.log('============================================\n');

  // Initialize components
  const unitController = new UnitController();
  await unitController.initialize({ turn: 0 });
  const storyTeller = new StoryTeller(unitController);

  // Create some maps and add them to the world
  const map1 = storyTeller.createMap('MainLand', 15, 10);
  const map2 = storyTeller.createMap('Forest', 12, 8);
  const world = storyTeller.getWorld();
  world.addMap(map1);
  world.addMap(map2);

  // Add gates between maps
  storyTeller.getWorldManager().addGate({
    mapFrom: 'MainLand',
    positionFrom: { x: 0, y: 5 },
    mapTo: 'Forest',
    positionTo: { x: 11, y: 3 },
    name: 'MainGate',
    bidirectional: true,
  });

  // Initialize the game loop
  const gameLoop = new GameLoop();

  // Place some units in the world initially using StoryTeller's moveUnitToPosition
  const allUnits = unitController.getUnits();
  if (allUnits.length > 0) {
    // Place first few units on the MainLand map
    const mainMap = world.getMap('MainLand');
    if (mainMap) {
      const positions = [
        { x: 2, y: 2 },
        { x: 5, y: 5 },
        { x: 8, y: 3 },
        { x: 12, y: 7 },
        { x: 1, y: 8 },
        { x: 14, y: 1 },
        { x: 7, y: 9 },
        { x: 4, y: 1 },
      ];

      for (let i = 0; i < Math.min(allUnits.length, positions.length); i++) {
        const unit = allUnits[i];
        const pos = positions[i];
        // Place unit in the world using WorldManager
        WorldManager.setUnitPosition(
          world,
          unit.id,
          'MainLand',
          new Position(pos.x, pos.y)
        );
      }
    }
  }

  // Run the game for a few turns
  console.log('Starting game loop...\n');

  gameLoop.start(async (turn: number) => {
    console.log(`\n--- Turn ${turn} ---`);

    // Generate story action using the storyteller
    const storyAction = await storyTeller.generateStoryAction(turn);
    console.log(`Story Action: ${storyAction.action.description}`);
    console.log(`Narrative: Turn ${turn}: ${storyAction.action.description}`);

    // Render the current state of all maps
    console.log('\nCurrent Map State:');
    const maps = world.getAllMaps();
    for (const map of maps) {
      console.log(MapRenderer.renderCompact(map));
      console.log('');
    }

    // Show unit positions
    console.log('Unit Positions:');
    for (const unit of unitController.getUnits()) {
      try {
        const position = world.getUnitPosition(unit.id);
        if (position) {
          console.log(
            `  ${unit.name} (${unit.id}) is at ${position.mapId} (${position.position.x}, ${position.position.y})`
          );
        } else {
          console.log(`  ${unit.name} (${unit.id}) position not set`);
        }
      } catch (error) {
        console.log(
          `  ${unit.name} (${unit.id}) not in world yet - Error: ${(error as Error).message}`
        );
      }
    }

    console.log('\n' + '='.repeat(50));

    // Stop after a certain number of turns
    if (turn >= 10) {
      gameLoop.stop();
      console.log('\nGame stopped. Final map state:');

      // Show final state of all maps
      const maps = world.getAllMaps();
      for (const map of maps) {
        console.log(MapRenderer.renderCompact(map));
        console.log('');
      }

      console.log('Final Unit Positions:');
      for (const unit of unitController.getUnits()) {
        try {
          const position = world.getUnitPosition(unit.id);
          if (position) {
            console.log(
              `  ${unit.name} (${unit.id}) is at ${position.mapId} (${position.position.x}, ${position.position.y})`
            );
          } else {
            console.log(`  ${unit.name} (${unit.id}) position not set`);
          }
        } catch (error) {
          console.log(
            `  ${unit.name} (${unit.id}) not in world yet - Error: ${(error as Error).message}`
          );
        }
      }
    }
  });

  // Stop after a few turns to see the map output
  setTimeout(() => {
    if (gameLoop.getRunning()) {
      gameLoop.stop();
      console.log('\nGame stopped due to timeout. Final map state:');

      // Show final state of all maps
      const maps = world.getAllMaps();
      for (const map of maps) {
        console.log(MapRenderer.renderCompact(map));
        console.log('');
      }

      console.log('Final Unit Positions:');
      for (const unit of unitController.getUnits()) {
        try {
          const position = world.getUnitPosition(unit.id);
          if (position) {
            console.log(
              `  ${unit.name} (${unit.id}) is at ${position.mapId} (${position.position.x}, ${position.position.y})`
            );
          } else {
            console.log(`  ${unit.name} (${unit.id}) position not set`);
          }
        } catch (error) {
          console.log(
            `  ${unit.name} (${unit.id}) not in world yet - Error: ${(error as Error).message}`
          );
        }
      }
    }
  }, 15000); // Stop after 15 seconds if not already stopped
}

// Run the example
runGameLoopWithMapRendering().catch(console.error);
