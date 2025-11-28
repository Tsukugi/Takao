/**
 * MapGenerator class for generating procedural maps with configurable parameters
 * Designed to be used by StoryTeller to create interconnected maps that make sense together
 */

import { Map, World } from '@atsu/choukai';
import { ConfigManager } from './ConfigManager';
import type { MapGenerationConfig } from './ConfigManager';

export class MapGenerator {
  private config: MapGenerationConfig;

  constructor() {
    this.config = this.loadMapGenerationConfig();
  }

  /**
   * Load map generation configuration, merging defaults with user config
   */
  private loadMapGenerationConfig(): MapGenerationConfig {
    return ConfigManager.getMapGenerationConfig();
  }

  /**
   * Generate a single map with procedural terrain
   */
  public generateMap(name: string, width?: number, height?: number): Map {
    const mapWidth = width || this.config.defaultMapWidth;
    const mapHeight = height || this.config.defaultMapHeight;

    const gameMap = new Map(mapWidth, mapHeight, name);

    // Add procedural terrain features
    this.addProceduralTerrain(gameMap);

    return gameMap;
  }

  /**
   * Generate a world with interconnected maps
   */
  public generateWorldWithMaps(mapNames: string[]): World {
    const world = new World();

    // Generate each map
    for (const name of mapNames) {
      const map = this.generateMap(name);
      world.addMap(map);
    }

    // Create connections between maps (roads at edges)
    if (this.config.createRoadsBetweenMaps) {
      this.createMapConnections(world);
    }

    return world;
  }

  /**
   * Add procedural terrain to a map based on configuration
   */
  private addProceduralTerrain(gameMap: Map): void {
    // Create water bodies
    if (this.config.waterFrequency > 0) {
      this.createWaterBodies(gameMap);
    }

    // Create mountain ranges
    if (this.config.mountainFrequency > 0) {
      this.createMountainRanges(gameMap);
    }

    // Create forest areas
    if (this.config.forestFrequency > 0) {
      this.createForestAreas(gameMap);
    }

    // Create desert areas
    if (this.config.desertFrequency > 0) {
      this.createDesertAreas(gameMap);
    }

    // Create swamp areas
    if (this.config.swampFrequency > 0) {
      this.createSwampAreas(gameMap);
    }

    // Create snow areas
    if (this.config.snowFrequency > 0) {
      this.createSnowAreas(gameMap);
    }

    // Create sand areas
    if (this.config.sandFrequency > 0) {
      this.createSandAreas(gameMap);
    }

    // Create roads
    if (this.config.roadFrequency > 0) {
      this.createRoads(gameMap);
    }
  }

  /**
   * Create water bodies based on frequency
   */
  private createWaterBodies(gameMap: Map): void {
    const numWaterBodies = Math.floor(
      (gameMap.width * gameMap.height * this.config.waterFrequency) /
        (this.config.minWaterBodySize * this.config.minWaterBodySize)
    );

    for (let i = 0; i < numWaterBodies; i++) {
      const size = Math.floor(
        Math.random() *
          (this.config.maxWaterBodySize - this.config.minWaterBodySize + 1) +
          this.config.minWaterBodySize
      );

      const x = Math.floor(Math.random() * (gameMap.width - size));
      const y = Math.floor(Math.random() * (gameMap.height - size));

      this.createWaterBody(gameMap, x, y, size, size);
    }
  }

  /**
   * Create a rectangular water body
   */
  private createWaterBody(
    gameMap: Map,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        const currX = Math.min(Math.max(x + i, 0), gameMap.width - 1);
        const currY = Math.min(Math.max(y + j, 0), gameMap.height - 1);
        gameMap.setTerrain(currX, currY, 'water');
      }
    }
  }

  /**
   * Create mountain ranges based on frequency
   */
  private createMountainRanges(gameMap: Map): void {
    const numMountainRanges = Math.floor(
      (gameMap.width * gameMap.height * this.config.mountainFrequency) /
        this.config.minMountainRangeLength
    );

    for (let i = 0; i < numMountainRanges; i++) {
      const length = Math.floor(
        Math.random() *
          (this.config.maxMountainRangeLength -
            this.config.minMountainRangeLength +
            1) +
          this.config.minMountainRangeLength
      );

      // Choose a random starting point
      const startX = Math.floor(Math.random() * gameMap.width);
      const startY = Math.floor(Math.random() * gameMap.height);

      // Choose a direction (horizontal, vertical, or diagonal)
      const direction = Math.floor(Math.random() * 4); // 0: right, 1: down, 2: right-down diagonal, 3: left-down diagonal

      this.createMountainRange(gameMap, startX, startY, length, direction);
    }
  }

  /**
   * Create a mountain range in a specific direction
   */
  private createMountainRange(
    gameMap: Map,
    x: number,
    y: number,
    length: number,
    direction: number
  ): void {
    let currX = x;
    let currY = y;

    for (let i = 0; i < length; i++) {
      const finalX = Math.min(Math.max(currX, 0), gameMap.width - 1);
      const finalY = Math.min(Math.max(currY, 0), gameMap.height - 1);

      gameMap.setTerrain(finalX, finalY, 'mountain');

      // Move in the chosen direction
      switch (direction) {
        case 0: // Right
          currX++;
          break;
        case 1: // Down
          currY++;
          break;
        case 2: // Diagonal (right-down)
          currX++;
          currY++;
          break;
        case 3: // Diagonal (left-down)
          currX--;
          currY++;
          break;
      }

      // If we go out of bounds, stop
      if (
        currX < 0 ||
        currX >= gameMap.width ||
        currY < 0 ||
        currY >= gameMap.height
      ) {
        break;
      }
    }
  }

  /**
   * Create forest areas based on frequency
   */
  private createForestAreas(gameMap: Map): void {
    const numForestAreas = Math.floor(
      (gameMap.width * gameMap.height * this.config.forestFrequency) /
        (this.config.minForestAreaSize * this.config.minForestAreaSize)
    );

    for (let i = 0; i < numForestAreas; i++) {
      const size = Math.floor(
        Math.random() *
          (this.config.maxForestAreaSize - this.config.minForestAreaSize + 1) +
          this.config.minForestAreaSize
      );

      const x = Math.floor(Math.random() * (gameMap.width - size));
      const y = Math.floor(Math.random() * (gameMap.height - size));

      this.createForestArea(gameMap, x, y, size, size);
    }
  }

  /**
   * Create a rectangular forest area
   */
  private createForestArea(
    gameMap: Map,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        const currX = Math.min(Math.max(x + i, 0), gameMap.width - 1);
        const currY = Math.min(Math.max(y + j, 0), gameMap.height - 1);
        gameMap.setTerrain(currX, currY, 'forest');
      }
    }
  }

  /**
   * Create desert areas
   */
  private createDesertAreas(gameMap: Map): void {
    const numDesertAreas = Math.floor(
      gameMap.width * gameMap.height * this.config.desertFrequency
    );

    for (let i = 0; i < numDesertAreas; i++) {
      const x = Math.floor(Math.random() * gameMap.width);
      const y = Math.floor(Math.random() * gameMap.height);
      if (gameMap.getTerrain(x, y) === 'grass') {
        // Only place on grass
        gameMap.setTerrain(x, y, 'desert');
      }
    }
  }

  /**
   * Create swamp areas
   */
  private createSwampAreas(gameMap: Map): void {
    const numSwampAreas = Math.floor(
      gameMap.width * gameMap.height * this.config.swampFrequency
    );

    for (let i = 0; i < numSwampAreas; i++) {
      const x = Math.floor(Math.random() * gameMap.width);
      const y = Math.floor(Math.random() * gameMap.height);
      if (gameMap.getTerrain(x, y) === 'grass') {
        // Only place on grass
        gameMap.setTerrain(x, y, 'swamp');
      }
    }
  }

  /**
   * Create snow areas
   */
  private createSnowAreas(gameMap: Map): void {
    const numSnowAreas = Math.floor(
      gameMap.width * gameMap.height * this.config.snowFrequency
    );

    for (let i = 0; i < numSnowAreas; i++) {
      const x = Math.floor(Math.random() * gameMap.width);
      const y = Math.floor(Math.random() * gameMap.height);
      if (gameMap.getTerrain(x, y) === 'grass') {
        // Only place on grass
        gameMap.setTerrain(x, y, 'snow');
      }
    }
  }

  /**
   * Create sand areas
   */
  private createSandAreas(gameMap: Map): void {
    const numSandAreas = Math.floor(
      gameMap.width * gameMap.height * this.config.sandFrequency
    );

    for (let i = 0; i < numSandAreas; i++) {
      const x = Math.floor(Math.random() * gameMap.width);
      const y = Math.floor(Math.random() * gameMap.height);
      if (gameMap.getTerrain(x, y) === 'grass') {
        // Only place on grass
        gameMap.setTerrain(x, y, 'sand');
      }
    }
  }

  /**
   * Create roads connecting interesting points
   */
  private createRoads(gameMap: Map): void {
    // For simplicity, create some straight roads
    // In a more complex implementation, we could use pathfinding to connect points of interest

    // Create a few horizontal roads
    for (let r = 0; r < 2; r++) {
      const y = Math.floor(Math.random() * (gameMap.height - 5)) + 2; // Avoid edges
      this.createHorizontalRoad(gameMap, y);
    }

    // Create a few vertical roads
    for (let r = 0; r < 2; r++) {
      const x = Math.floor(Math.random() * (gameMap.width - 5)) + 2; // Avoid edges
      this.createVerticalRoad(gameMap, x);
    }
  }

  /**
   * Create a horizontal road at a given Y coordinate
   */
  private createHorizontalRoad(gameMap: Map, y: number): void {
    for (let x = 0; x < gameMap.width; x++) {
      // Only create road if it's not water or mountain
      const currentTerrain = gameMap.getTerrain(x, y);
      if (currentTerrain !== 'water' && currentTerrain !== 'mountain') {
        gameMap.setTerrain(x, y, 'road');
      }
    }
  }

  /**
   * Create a vertical road at a given X coordinate
   */
  private createVerticalRoad(gameMap: Map, x: number): void {
    for (let y = 0; y < gameMap.height; y++) {
      // Only create road if it's not water or mountain
      const currentTerrain = gameMap.getTerrain(x, y);
      if (currentTerrain !== 'water' && currentTerrain !== 'mountain') {
        gameMap.setTerrain(x, y, 'road');
      }
    }
  }

  /**
   * Create connections between maps (roads at map edges)
   */
  private createMapConnections(world: World): void {
    const maps = world.getAllMaps();

    // For now, simply connect maps in sequence
    // A more advanced implementation would use a world map to determine logical connections

    maps.forEach((map, index) => {
      if (index >= maps.length - 1) return;
      const nextMap = maps[index + 1] as Map;
      this.connectMaps(world, map.name, nextMap.name);
    });
  }

  /**
   * Connect two maps by placing roads at their edges
   */
  private connectMaps(world: World, map1Name: string, map2Name: string): void {
    try {
      const map1 = world.getMap(map1Name);
      const map2 = world.getMap(map2Name);

      // Simple connection: create roads at the right edge of map1 and left edge of map2
      // This is a basic implementation - in reality, you'd want more sophisticated logic

      // Add roads along the right edge of map1
      for (let y = 0; y < Math.min(map1.height, 3); y++) {
        const x = map1.width - 1; // Rightmost column
        if (
          map1.getTerrain(x, y) !== 'water' &&
          map1.getTerrain(x, y) !== 'mountain'
        ) {
          map1.setTerrain(x, y, 'road');
        }
      }

      // Add roads along the left edge of map2
      for (let y = 0; y < Math.min(map2.height, 3); y++) {
        const x = 0; // Leftmost column
        if (
          map2.getTerrain(x, y) !== 'water' &&
          map2.getTerrain(x, y) !== 'mountain'
        ) {
          map2.setTerrain(x, y, 'road');
        }
      }
    } catch (error) {
      console.warn(
        `Could not connect maps ${map1Name} and ${map2Name}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Update the configuration (for runtime changes)
   */
  public updateConfig(newConfig: Partial<MapGenerationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get the current configuration
   */
  public getConfig(): MapGenerationConfig {
    return { ...this.config }; // Return a copy to prevent external modification
  }
}
