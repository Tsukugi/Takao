import * as fs from 'fs';
import * as path from 'path';

interface AppConfig {
  maxTurnsPerSession: number;
  overrideAvailableActions?: string[];
}

export class ConfigManager {
  private static config: AppConfig | null = null;

  /**
   * Load the configuration from the JSON file
   */
  public static loadConfig(): AppConfig {
    if (this.config) {
      return this.config;
    }

    // Try to load from config file in data directory
    const configPath = path.resolve('data', 'config.json');

    if (fs.existsSync(configPath)) {
      const configRaw = fs.readFileSync(configPath, 'utf8');
      try {
        this.config = JSON.parse(configRaw) as AppConfig;
      } catch (error) {
        console.warn('Invalid config.json format, using defaults:', error);
        this.config = this.getDefaultConfig();
      }
    } else {
      console.warn('config.json not found, using defaults');
      this.config = this.getDefaultConfig();
    }

    return this.config;
  }

  private static getDefaultConfig(): AppConfig {
    return {
      maxTurnsPerSession: 10,
    };
  }

  /**
   * Get engine configuration
   */
  public static getConfig(): AppConfig {
    return this.loadConfig();
  }

  /**
   * Reset the configuration (for testing purposes)
   */
  public static resetConfig(): void {
    this.config = null;
  }
}
