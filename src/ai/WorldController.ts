// Import types from the Choukai library
import { World as ChoukaiWorld, Map as ChoukaiMap } from '@atsu/choukai';
import { DataManager } from '../utils/DataManager';

/**
 * Represents the World controller that connects to the Choukai library
 * to manage game worlds, maps and their positioning systems
 */
export class WorldController {
  private world: ChoukaiWorld;

  constructor() {
    this.world = this.initializeWorld();
  }

  /**
   * Initializes the World controller with the game world
   */
  private initializeWorld(): ChoukaiWorld {
    // Try to load existing world from file
    const loadedWorld = DataManager.loadWorld();

    if (loadedWorld) {
      // Use the loaded world
      console.log(
        `Loaded world with ${loadedWorld.getAllMaps().length} maps from saved state`
      );
      return loadedWorld;
    } else {
      // Create a new world instance
      console.log('Initialized new world with Choukai library');
      return new ChoukaiWorld();
    }
  }

  /**
   * Gets the current world instance
   */
  public getWorld(): ChoukaiWorld {
    return this.world;
  }

  /**
   * Creates a new map and adds it to the world
   */
  public createMap(width: number, height: number, name: string): boolean {
    const newMap = new ChoukaiMap(width, height, name);
    return this.world.addMap(newMap);
  }

  /**
   * Gets a map by name from the world
   */
  public getMap(name: string): ChoukaiMap {
    try {
      return this.world.getMap(name);
    } catch {
      throw new Error('Map not found in the world');
    }
  }

  /**
   * Gets all maps in the world
   */
  public getAllMaps(): ChoukaiMap[] {
    return this.world.getAllMaps();
  }

  /**
   * Saves the current world state to file
   */
  public async saveWorld(): Promise<void> {
    DataManager.saveWorld(this.world);
    console.log('World saved to file');
  }
}
