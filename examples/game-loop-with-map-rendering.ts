/**
 * Game Loop Example with Map Rendering Display
 * Shows narrative generation from StoryTeller along with map rendering
 */

import { GameLoop } from '../src/core/GameLoop';
import { StoryTeller } from '../src/core/StoryTeller';
import { UnitController } from '../src/ai/UnitController';
import type { BaseUnit, IUnitPosition } from '@atsu/atago';
import { Map as GameMap, Position, type TerrainType } from '@atsu/choukai';

async function runGameLoopWithMapRendering() {
  console.log('Takao Engine - Game Loop with Map Rendering');
  console.log('============================================\n');

  const TERRAIN_SYMBOLS: Record<TerrainType, string> = {
    grass: '.',
    water: '~',
    mountain: '^',
    wall: '|',
    forest: 't',
    desert: '#',
    road: '=',
    plains: '.',
    swamp: ':',
    snow: '*',
    sand: '-',
  };

  const setUnitPosition = (
    unit: BaseUnit,
    mapId: string,
    x: number,
    y: number
  ) => {
    unit.setProperty('position', {
      unitId: unit.id,
      mapId,
      position: new Position(x, y),
    });
  };

  const renderMapCompact = (map: GameMap, units: BaseUnit[]) => {
    const unitLookup = new Map<string, BaseUnit>();
    for (const unit of units) {
      const unitPosition = unit.getPropertyValue<IUnitPosition>('position');
      if (unitPosition?.mapId !== map.name) continue;
      unitLookup.set(
        `${unitPosition.position.x},${unitPosition.position.y}`,
        unit
      );
    }

    const lines: string[] = [];
    for (let y = 0; y < map.height; y++) {
      let line = '';
      for (let x = 0; x < map.width; x++) {
        const unit = unitLookup.get(`${x},${y}`);
        if (unit) {
          line += (unit.name || unit.id).charAt(0).toUpperCase();
          continue;
        }

        const cell = map.getCell(x, y);
        const terrain = cell?.terrain || 'grass';
        line += TERRAIN_SYMBOLS[terrain] || '?';
      }
      lines.push(line);
    }

    return lines.join('\n');
  };

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
      if (!unit || !pos) continue;
      setUnitPosition(unit, 'MainLand', pos.x, pos.y);
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
      console.log(renderMapCompact(map, unitController.getUnits()));
      console.log('');
    }

    // Show unit positions
    console.log('Unit Positions:');
    for (const unit of unitController.getUnits()) {
      const position = unit.getPropertyValue<IUnitPosition>('position');
      if (position) {
        console.log(
          `  ${unit.name} (${unit.id}) is at ${position.mapId} (${position.position.x}, ${position.position.y})`
        );
      } else {
        console.log(`  ${unit.name} (${unit.id}) position not set`);
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
        console.log(renderMapCompact(map, unitController.getUnits()));
        console.log('');
      }

      console.log('Final Unit Positions:');
      for (const unit of unitController.getUnits()) {
        const position = unit.getPropertyValue<IUnitPosition>('position');
        if (position) {
          console.log(
            `  ${unit.name} (${unit.id}) is at ${position.mapId} (${position.position.x}, ${position.position.y})`
          );
        } else {
          console.log(`  ${unit.name} (${unit.id}) position not set`);
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
        console.log(renderMapCompact(map, unitController.getUnits()));
        console.log('');
      }

      console.log('Final Unit Positions:');
      for (const unit of unitController.getUnits()) {
        const position = unit.getPropertyValue<IUnitPosition>('position');
        if (position) {
          console.log(
            `  ${unit.name} (${unit.id}) is at ${position.mapId} (${position.position.x}, ${position.position.y})`
          );
        } else {
          console.log(`  ${unit.name} (${unit.id}) position not set`);
        }
      }
    }
  }, 15000); // Stop after 15 seconds if not already stopped
}

// Run the example
runGameLoopWithMapRendering().catch(console.error);
