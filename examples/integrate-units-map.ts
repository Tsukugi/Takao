/**
 * Example: Integration with Atago Units (Updated to use Takao's MapGenerator)
 *
 * This example demonstrates how Choukai maps generated with Takao's MapGenerator
 * can work with Atago units to provide spatial awareness and terrain-based effects.
 */

import { BaseUnit, type IUnitPosition } from '@atsu/atago';
import { Position, World } from '@atsu/choukai';
import { MapGenerator } from '../src/utils/MapGenerator';

console.log(
  '=== Choukai Example: Integration with Atago Units (via Takao MapGenerator) ===\n'
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
console.log('MapGenerator created with configurable settings');

// Generate a game map using the MapGenerator with procedural terrain
const gameMap = mapGenerator.generateMap('Strategy Field', 20, 20);
console.log(
  `Created map via MapGenerator: ${gameMap.name}, dimensions: ${gameMap.width}x${gameMap.height}`
);

// The map already has procedurally generated terrain, but we can still set specific terrain if needed
// Set up terrain that affects units differently
gameMap.setTerrain(5, 5, 'water', { movementCost: 2.5, defenseBonus: -1 });
gameMap.setTerrain(10, 10, 'mountain', { movementCost: 4.0, defenseBonus: 2 });
gameMap.setTerrain(15, 15, 'forest', {
  movementCost: 1.5,
  defenseBonus: 1,
  visibilityModifier: 0.7,
});

// Create real Atago units
const playerUnit = new BaseUnit('player-1', 'Hero', 'hero');
playerUnit.setProperty('health', 100);
playerUnit.setProperty('attack', 20);
playerUnit.setProperty('defense', 10);
playerUnit.setProperty('speed', 5);
playerUnit.setProperty('movementRange', 3);

const enemyUnit = new BaseUnit('enemy-1', 'Orc', 'monster');
enemyUnit.setProperty('health', 80);
enemyUnit.setProperty('attack', 25);
enemyUnit.setProperty('defense', 8);
enemyUnit.setProperty('speed', 3);
enemyUnit.setProperty('movementRange', 2);

console.log(`Created units:`);
console.log(`- ${playerUnit.name} (ID: ${playerUnit.id})`);
console.log(`- ${enemyUnit.name} (ID: ${enemyUnit.id})`);
const units = [playerUnit, enemyUnit];

// Create a world with interconnected maps using the MapGenerator
const world = mapGenerator.generateWorldWithMaps(['Strategy Field']);
console.log(`World created with ${world.getAllMaps().length} maps`);

// Place units in the world
setUnitPosition(playerUnit, 'Strategy Field', 5, 4); // Near water
setUnitPosition(enemyUnit, 'Strategy Field', 9, 10); // Near mountain

console.log(`\nUnits placed in the world:`);
units.forEach(unit => {
  const unitPosition = unit.getPropertyValue<IUnitPosition>('position');
  console.log(`- ${unit.id} at position ${unitPosition?.position.toString()}`);
});

// Function to apply terrain effects to a unit
function applyTerrainEffects(unit: BaseUnit, world: World, mapName: string) {
  const pos = unit.getPropertyValue<IUnitPosition>('position');
  if (!pos || pos.mapId !== mapName) return;

  const map = world.getMap(mapName);
  const terrainProps = map.getTerrainProperties(pos.position.x, pos.position.y);
  if (!terrainProps) return;

  // Apply defense bonus if present
  if (terrainProps.defenseBonus !== undefined) {
    const currentDefense = unit.getPropertyValue<number>('defense') || 0;
    const newDefense = currentDefense + terrainProps.defenseBonus;
    unit.setProperty('defense', newDefense);
    console.log(
      `Applied terrain defense bonus to ${unit.id}. New defense: ${newDefense}`
    );
  }

  // Store movement cost for reference
  const movementCost = map.getMovementCost(pos.position.x, pos.position.y);
  unit.setProperty('currentTerrainCost', movementCost);
  console.log(`${unit.id} terrain movement cost: ${movementCost}`);
}

console.log(`\nApplying terrain effects:`);
applyTerrainEffects(playerUnit, world, 'Strategy Field');
applyTerrainEffects(enemyUnit, world, 'Strategy Field');

// Show unit properties after terrain effects
console.log(`\nFinal unit properties:`);
console.log(
  `${playerUnit.name} defense: ${playerUnit.getPropertyValue('defense')}`
);
console.log(
  `${playerUnit.name} terrain cost: ${playerUnit.getPropertyValue('currentTerrainCost')}`
);

console.log(
  `${enemyUnit.name} defense: ${enemyUnit.getPropertyValue('defense')}`
);
console.log(
  `${enemyUnit.name} terrain cost: ${enemyUnit.getPropertyValue('currentTerrainCost')}`
);

// Move units and see how terrain affects them
console.log(`\nMoving player toward the water terrain...`);
setUnitPosition(playerUnit, 'Strategy Field', 5, 5); // Into water terrain
applyTerrainEffects(playerUnit, world, 'Strategy Field');
console.log(
  `${playerUnit.name} now in water. Defense: ${playerUnit.getPropertyValue('defense')}, Cost: ${playerUnit.getPropertyValue('currentTerrainCost')}`
);

console.log(`\nMoving enemy toward the mountain terrain...`);
setUnitPosition(enemyUnit, 'Strategy Field', 10, 10); // Into mountain terrain
applyTerrainEffects(enemyUnit, world, 'Strategy Field');
console.log(
  `${enemyUnit.name} now in mountain. Defense: ${enemyUnit.getPropertyValue('defense')}, Cost: ${enemyUnit.getPropertyValue('currentTerrainCost')}`
);

// Show configuration used by MapGenerator
console.log('\nMap generation configuration used:');
console.log(
  JSON.stringify(
    {
      defaultMapWidth: mapGenerator.getConfig().defaultMapWidth,
      defaultMapHeight: mapGenerator.getConfig().defaultMapHeight,
      waterFrequency: mapGenerator.getConfig().waterFrequency,
      createRoadsBetweenMaps: mapGenerator.getConfig().createRoadsBetweenMaps,
    },
    null,
    2
  )
);

console.log(
  '\nIntegration with Atago Units example completed with Takao MapGenerator!'
);
