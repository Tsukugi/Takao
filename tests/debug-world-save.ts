import { TakaoImpl } from '../src/TakaoImpl';
import { DataManager } from '../src/utils/DataManager';
import * as fs from 'fs';
import * as path from 'path';

async function debugWorldSave() {
  console.log('=== Debug World Save Process ===');
  
  // Ensure data directory exists
  DataManager.ensureDataDirectory();
  
  // Reset world file to empty
  const worldFile = path.join(DataManager.DATA_DIR, 'world.json');
  fs.writeFileSync(worldFile, JSON.stringify({ maps: [] }, null, 2));
  console.log('Reset world.json to empty state');
  
  const takao = new TakaoImpl();
  
  console.log('Initializing Takao...');
  await takao.initialize();
  
  // Check world state after initialization
  const worldAfterInit = takao.getWorld();
  const mapsAfterInit = worldAfterInit.getAllMaps();
  console.log(`After initialization: ${mapsAfterInit.length} maps in memory`);
  
  // Manually trigger save by accessing the game engine's world controller
  const gameEngine: any = takao['gameEngine']; // Access private property
  const worldController = gameEngine.worldController;
  
  console.log('About to save world...');
  await worldController.saveWorld(); // Use async version to make sure it completes
  console.log('World saved via controller');
  
  // Check file content immediately after save
  const fileContent = fs.readFileSync(worldFile, 'utf-8');
  console.log('File content after save:', fileContent.substring(0, 200) + (fileContent.length > 200 ? '...' : ''));
  
  const data = JSON.parse(fileContent);
  console.log(`Maps in saved file: ${data.maps.length}`);
  
  takao.stop();
  console.log('Takao stopped');
}

debugWorldSave().catch(console.error);