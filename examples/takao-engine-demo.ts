/**
 * Main Takao Engine Example
 * Demonstrates the integration of all features through TakaoImpl class
 */

import { TakaoImpl } from '../src/TakaoImpl';
import { Logger } from '../src/utils/Logger';

async function runTakaoEngine() {
  const logger = new Logger({ prefix: 'TakaoDemo' });
  logger.info('Takao Engine - Integrated Features Demo');
  logger.info('=====================================\n');

  // Create and initialize the Takao Engine implementation with visual-only mode
  const takao = new TakaoImpl(); // Set to true to see only maps
  await takao.initialize();

  // Start the game
  takao.start();
}

// Run the example
runTakaoEngine().catch(console.error);
