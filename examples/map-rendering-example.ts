/**
 * Example demonstrating map rendering in Takao Engine
 */

import { StoryTeller } from '../src/core/StoryTeller';
import { UnitController } from '../src/ai/UnitController';
import { MapRenderer } from '../src/utils/MapRenderer';
import { BaseUnit } from '@atsu/atago';

async function runMapRenderingExample() {
  console.log('Takao Engine - Map Rendering Example');
  console.log('====================================\n');

  // Initialize the unit controller
  const unitController = new UnitController();
  await unitController.initialize({ turn: 0 });

  // Create a storyteller instance
  const storyTeller = new StoryTeller(unitController);

  // Create a sample map using the MapGenerator
  console.log('1. Creating a sample map using MapGenerator...\n');
  const map = storyTeller.createMap('ExampleMap', 20, 15);

  // Create some sample units and add them to the map
  const unit1 = new BaseUnit('unit1', 'Guard', 'warrior');
  unit1.setProperty('health', 100);
  const unit2 = new BaseUnit('unit2', 'Scout', 'ranger');
  unit2.setProperty('health', 80);

  // Place units on the map
  map.placeUnit('unit1', 5, 5);
  map.placeUnit('unit2', 10, 8);

  // Display the map using MapRenderer
  console.log('2. Rendering the map with units:\n');
  const mapString = MapRenderer.renderCompact(map);
  console.log(mapString);

  // Demonstrate multiple map rendering
  console.log('\n3. Creating and rendering a second map:\n');
  const map2 = storyTeller.createMap('ForestMap', 15, 10);

  // Place some units on the second map
  map2.placeUnit('unit1', 3, 7);
  map2.placeUnit('unit2', 12, 2);

  const map2String = MapRenderer.renderCompact(map2);
  console.log(map2String);

  // Show how to use different rendering options
  console.log('\n4. Rendering with detailed view:\n');
  const detailedMapString = MapRenderer.renderDetailed(map);
  console.log(detailedMapString);

  // Show legend
  console.log('\n5. Terrain legend:\n');
  console.log(MapRenderer.renderLegend());

  console.log('\n6. Demonstrating World with multiple maps and gates:\n');
  // Create maps with gates
  const world = storyTeller.getWorld();
  world.addMap(map);
  world.addMap(map2);

  // Add a gate connecting positions between maps
  const gateAdded = storyTeller.addGate({
    mapFrom: 'ExampleMap',
    positionFrom: { x: 0, y: 5 }, // Left edge of first map
    mapTo: 'ForestMap',
    positionTo: { x: 14, y: 5 }, // Right edge of second map
    name: 'MainGate',
    bidirectional: true,
  });

  console.log(`Gate added: ${gateAdded}`);
  console.log(`Total gates in system: ${storyTeller.getAllGates().length}`);

  // Show world information
  console.log(`\nWorld contains ${world.getAllMaps().length} maps`);
  console.log(
    `Maps: ${world
      .getAllMaps()
      .map(m => m.name)
      .join(', ')}`
  );

  console.log('\nExample completed successfully!');
}

// Run the example
runMapRenderingExample().catch(console.error);
