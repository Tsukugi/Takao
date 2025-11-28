/**
 * Main Takao Engine Example
 * Demonstrates the integration of all features through TakaoImpl class
 */

import { TakaoImpl } from '../src/TakaoImpl';

async function runTakaoEngine() {
  console.log('Takao Engine - Integrated Features Demo');
  console.log('=====================================\n');

  // Create and initialize the Takao Engine implementation
  const takao = new TakaoImpl();
  await takao.initialize();

  // Start the game
  takao.start();
}

// Run the example
runTakaoEngine().catch(console.error);
