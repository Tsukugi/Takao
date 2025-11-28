/**
 * Example: MapRenderer Usage
 *
 * Demonstrates the MapRenderer class for visualizing game maps
 */

import { Map as GameMap } from '@atsu/choukai';
import { MapRenderer } from '../src/utils/MapRenderer';

console.log('=== Takao Engine - MapRenderer Example ===\n');

// Create a sample map
const gameMap = new GameMap(15, 10, 'Example Realm');

// Add some terrain
gameMap.setTerrain(3, 3, 'water');
gameMap.setTerrain(4, 3, 'water');
gameMap.setTerrain(3, 4, 'water');
gameMap.setTerrain(5, 5, 'mountain');
gameMap.setTerrain(6, 5, 'mountain');
gameMap.setTerrain(7, 7, 'forest');
gameMap.setTerrain(8, 7, 'forest');
gameMap.setTerrain(9, 7, 'forest');
gameMap.setTerrain(2, 8, 'desert');
gameMap.setTerrain(12, 2, 'road');

// Place some units
gameMap.placeUnit('P', 2, 2); // Player unit
gameMap.placeUnit('E', 8, 2); // Enemy unit
gameMap.placeUnit('N', 10, 5); // NPC unit

console.log('Compact Render:');
console.log(MapRenderer.renderCompact(gameMap));
console.log('');

console.log('Detailed Render:');
console.log(MapRenderer.renderDetailed(gameMap));
console.log('');

console.log('Custom Config Render (showing coordinates):');
console.log(
  MapRenderer.render(gameMap, { showCoordinates: true, cellWidth: 1 })
);
console.log('');

console.log('With Highlight:');
import { Position } from '@atsu/choukai';
console.log(MapRenderer.renderWithHighlight(gameMap, new Position(5, 5), '@'));
console.log('');

console.log('Legend:');
console.log(MapRenderer.renderLegend());
console.log('');

// Create another map with more complex terrain
const complexMap = new GameMap(20, 12, 'Complex Terrain');

// Generate some interesting terrain
for (let x = 0; x < 5; x++) {
  for (let y = 0; y < 5; y++) {
    complexMap.setTerrain(x, y, 'water');
  }
}

for (let x = 10; x < 15; x++) {
  for (let y = 5; y < 10; y++) {
    complexMap.setTerrain(x, y, 'mountain');
  }
}

for (let x = 5; x < 10; x++) {
  complexMap.setTerrain(x, 7, 'road');
}

// Place multiple units
complexMap.placeUnit('A', 1, 1);
complexMap.placeUnit('B', 12, 6);
complexMap.placeUnit('C', 6, 8);

console.log('Complex Map Render:');
console.log(MapRenderer.renderCompact(complexMap));
console.log('');
console.log('Complex Map Legend:');
console.log(MapRenderer.renderLegend());

console.log('\n=== MapRenderer Example Completed ===');
