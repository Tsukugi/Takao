// Import types from the Choukai library
import { World as ChoukaiWorld, Map as ChoukaiMap } from '@atsu/choukai';
import { DataManager } from '../utils/DataManager';

/**
 * Represents the World controller that connects to the Choukai library
 * to manage game worlds, maps and their positioning systems
 */
export class WorldController {
  private world: ChoukaiWorld | null = null;
  private initialized: boolean = false;

  /**
   * Initializes the World controller with the game world
   */
  public async initialize(): Promise<void> {
    // Try to load existing world from file
    const loadedWorld = DataManager.loadWorld();

    if (loadedWorld) {
      // Use the loaded world
      this.world = loadedWorld;
      console.log(`Loaded world with ${this.world.getAllMaps().length} maps from saved state`);
    } else {
      // Create a new world instance
      this.world = new ChoukaiWorld();
      console.log('Initialized new world with Choukai library');
    }

    this.initialized = true;
    console.log('WorldController initialized');
  }

  /**
   * Gets the current world instance
   */
  public getWorld(): ChoukaiWorld | null {
    if (!this.initialized) {
      throw new Error('WorldController not initialized');
    }
    return this.world;
  }

  /**
   * Creates a new map and adds it to the world
   */
  public createMap(width: number, height: number, name: string): boolean {
    if (!this.initialized || !this.world) {
      throw new Error('WorldController not initialized');
    }

    const newMap = new ChoukaiMap(width, height, name);
    return this.world.addMap(newMap);
  }

  /**
   * Gets a map by name from the world
   */
  public getMap(name: string): ChoukaiMap | null {
    if (!this.initialized || !this.world) {
      throw new Error('WorldController not initialized');
    }

    try {
      return this.world.getMap(name);
    } catch {
      return null; // Map doesn't exist
    }
  }

  /**
   * Gets all maps in the world
   */
  public getAllMaps(): ChoukaiMap[] {
    if (!this.initialized || !this.world) {
      throw new Error('WorldController not initialized');
    }
    
    return this.world.getAllMaps();
  }

  /**
   * Saves the current world state to file
   */
  public async saveWorld(): Promise<void> {
    if (!this.initialized || !this.world) {
      throw new Error('WorldController not initialized');
    }

    DataManager.saveWorld(this.world);
    console.log('World saved to file');
  }

  /**
   * Gets whether the world controller is initialized
   */
  public getInitialized(): boolean {
    return this.initialized;
  }
}