/**
 * Example: Basic Map Usage (Updated to use Takao's MapGenerator)
 *
 * This example demonstrates the core functionality using Takao's MapGenerator
 * for creating and using maps with the Choukai library for unit positioning
 * and terrain management.
 */

import { BaseUnit, type IUnitPosition } from '@atsu/atago';
import { Position } from '@atsu/choukai';
import { MapGenerator } from '../src/utils/MapGenerator';
import { UnitPosition } from '../src/utils/UnitPosition';

console.log(
  '=== Choukai Example: Basic Map Usage (via Takao MapGenerator) ===\n'
);

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

// Create a MapGenerator instance
const mapGenerator = new MapGenerator();
console.log('MapGenerator created successfully');

// Generate a map using the MapGenerator
const gameMap = mapGenerator.generateMap('Battlefield', 10, 10);
console.log(
  `Created map via MapGenerator: ${gameMap.name}, dimensions: ${gameMap.width}x${gameMap.height}`
);

// The MapGenerator has already set up procedural terrain, but we can still manually set specific terrain
gameMap.setTerrain(5, 5, 'water');
gameMap.setTerrain(3, 3, 'mountain');
gameMap.setTerrain(7, 7, 'forest');

console.log(`Terrain at (5,5): ${gameMap.getTerrain(5, 5)}`); // water
console.log(`Terrain at (3,3): ${gameMap.getTerrain(3, 3)}`); // mountain
console.log(`Terrain at (7,7): ${gameMap.getTerrain(7, 7)}`); // forest

// Check movement costs for different terrains
console.log(`Movement cost at (5,5) (water): ${gameMap.getMovementCost(5, 5)}`); // 2.0
console.log(
  `Movement cost at (3,3) (mountain): ${gameMap.getMovementCost(3, 3)}`
); // 3.0
console.log(`Movement cost at (1,1) (grass): ${gameMap.getMovementCost(1, 1)}`); // 1.0

// Create a position
const pos = new Position(2, 2);
console.log(`\nCreated position: ${pos.toString()}`);

// Calculate distance between positions
const pos2 = new Position(5, 6);
const distance = pos.distanceTo(pos2);
console.log(
  `Distance from ${pos.toString()} to ${pos2.toString()}: ${distance}`
);

// Place units on the map
console.log('\nPlacing units on the map...');
const playerUnit = new BaseUnit('player-1', 'Hero', 'hero');
const enemyUnit = new BaseUnit('enemy-1', 'Raider', 'raider');

setUnitPosition(playerUnit, gameMap.name, 2, 2);
setUnitPosition(enemyUnit, gameMap.name, 8, 8);
const units = [playerUnit, enemyUnit];

const playerPos = playerUnit.getPropertyValue<IUnitPosition>('position');
const enemyPos = enemyUnit.getPropertyValue<IUnitPosition>('position');
console.log(`Player placed at: ${playerPos?.position.toString()}`);
console.log(`Enemy placed at: ${enemyPos?.position.toString()}`);

// Check if positions are walkable terrain and whether a unit occupies them
console.log(`Is (2,2) walkable terrain? ${gameMap.isWalkable(2, 2)}`);
console.log(
  `Is (2,2) occupied? ${Boolean(
    UnitPosition.getUnitAtPosition(units, gameMap.name, 2, 2)
  )}`
);
console.log(`Is (1,1) walkable terrain? ${gameMap.isWalkable(1, 1)}`);
console.log(
  `Is (1,1) occupied? ${Boolean(
    UnitPosition.getUnitAtPosition(units, gameMap.name, 1, 1)
  )}`
);

// Check what units are on the map
const mapUnits = UnitPosition.getUnitsInMap(units, gameMap.name);
console.log(`Units on map: ${mapUnits.length}`);
mapUnits.forEach(unit => {
  const unitPosition = unit.getPropertyValue<IUnitPosition>('position');
  console.log(`- ${unit.id} at ${unitPosition?.position.toString()}`);
});

// Create a world using the MapGenerator
console.log('\n=== World Management with MapGenerator ===');
const world = mapGenerator.generateWorldWithMaps(['Battlefield', 'Forest']);

console.log(`Maps in world: ${world.getAllMaps().length}`);

// Place units in the world
const forestUnit = new BaseUnit('forest-creature', 'Sprite', 'creature');
setUnitPosition(playerUnit, 'Battlefield', 2, 2);
setUnitPosition(enemyUnit, 'Battlefield', 8, 8);
setUnitPosition(forestUnit, 'Forest', 7, 7);
const worldUnits = [playerUnit, enemyUnit, forestUnit];

console.log('\nUnits in world:');
worldUnits.forEach(unit => {
  const unitPosition = unit.getPropertyValue<IUnitPosition>('position');
  console.log(
    `- ${unit.id} on map '${unitPosition?.mapId}' at ${unitPosition?.position.toString()}`
  );
});

// Move a unit
setUnitPosition(playerUnit, 'Battlefield', 3, 2);
console.log(`\nAfter moving player-1 to (3,2):`);
const movedPlayerPos = playerUnit.getPropertyValue<IUnitPosition>('position');
console.log(`Player position: ${movedPlayerPos?.position.toString()}`);

// Calculate distance between units (only if they're on the same map)
const distanceBetween = UnitPosition.getDistanceBetweenUnits(
  worldUnits,
  'player-1',
  'enemy-1'
);
console.log(`Distance between player and enemy: ${distanceBetween}`);

// Show the configuration being used by the MapGenerator
console.log('\nMapGenerator configuration:');
console.log(JSON.stringify(mapGenerator.getConfig(), null, 2));

console.log('\nBasic Map Usage example completed with Takao MapGenerator!');
