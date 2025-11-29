/**
 * MapRenderer class for visualizing game maps in console format
 */

import { Map as GameMap, Position, type TerrainType } from '@atsu/choukai';

export interface MapRendererConfig {
  showCoordinates: boolean;
  cellWidth: number;
  showUnits: boolean;
  showTerrain: boolean;
  compactView: boolean;
  useColors?: boolean;
}

export interface FixedDisplayState {
  height: number;
  width: number;
  lastRenderTime: number;
}

export class MapRenderer {
  private static readonly TERRAIN_SYMBOLS: Record<TerrainType, string> = {
    grass: '.',
    water: '~',
    mountain: '^',
    forest: 't',
    desert: '#',
    road: '=',
    plains: '.',
    swamp: ':',
    snow: '*',
    sand: '-',
  };

  private static readonly TERRAIN_COLORS: Record<TerrainType, string> = {
    grass: '\x1b[90m', // bright black (gray)
    water: '\x1b[34m', // blue
    mountain: '\x1b[37m', // white
    forest: '\x1b[32m', // green
    desert: '\x1b[33m', // yellow
    road: '\x1b[90m', // gray
    plains: '\x1b[36m', // cyan
    swamp: '\x1b[35m', // magenta
    snow: '\x1b[97m', // bright white
    sand: '\x1b[93m', // bright yellow
  };

  private static readonly UNIT_COLOR = '\x1b[92m'; // bright green
  private static readonly RESET_COLOR = '\x1b[0m'; // reset

  private static readonly DEFAULT_CONFIG: MapRendererConfig = {
    showCoordinates: true,
    cellWidth: 1,
    showUnits: true,
    showTerrain: true,
    compactView: true,
    useColors: true,
  };

  /**
   * Renders a map to console-friendly string representation
   */
  public static render(
    map: GameMap,
    unitNames?: Record<string, string>, // Optional mapping from unit ID to unit name
    config?: Partial<MapRendererConfig>
  ): string {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const lines: string[] = [];

    // Add title
    lines.push(`Map: ${map.name} (${map.width}x${map.height})`);
    lines.push('');

    if (finalConfig.showCoordinates && !finalConfig.compactView) {
      // Add X coordinate labels
      let coordLine = finalConfig.cellWidth > 1 ? '    ' : '  ';
      for (let x = 0; x < map.width; x++) {
        const coordStr = x.toString().padStart(finalConfig.cellWidth, ' ');
        coordLine += coordStr + (finalConfig.cellWidth > 1 ? ' ' : '');
      }
      lines.push(coordLine);
    }

    // Render each row
    for (let y = 0; y < map.height; y++) {
      let row = '';

      if (finalConfig.showCoordinates) {
        if (finalConfig.compactView) {
          row += `${y.toString().padStart(2, ' ')}|`;
        } else {
          row += `${y.toString().padStart(2, ' ')} |`;
        }
      }

      for (let x = 0; x < map.width; x++) {
        const cell = map.getCell(x, y);
        let cellContent = '';

        if (finalConfig.showUnits) {
          const unitId = map.getUnitAt(x, y);
          if (unitId) {
            // Use first character of unit name if available, otherwise use first character of ID
            if (unitNames && unitNames[unitId]) {
              cellContent = unitNames[unitId].charAt(0).toUpperCase();
            } else {
              cellContent = unitId.charAt(0).toUpperCase();
            }
            // Apply unit color if enabled
            if (finalConfig.useColors) {
              cellContent = `${this.UNIT_COLOR}${cellContent}${this.RESET_COLOR}`;
            }
          }
        }

        if (!cellContent && finalConfig.showTerrain) {
          const terrain = cell ? cell.terrain : 'grass';
          cellContent =
            this.TERRAIN_SYMBOLS[
              terrain as keyof typeof this.TERRAIN_SYMBOLS
            ] || '?';
          // Apply terrain color if enabled
          if (finalConfig.useColors) {
            const terrainColor =
              this.TERRAIN_COLORS[
                terrain as keyof typeof this.TERRAIN_COLORS
              ] || this.TERRAIN_COLORS.grass;
            cellContent = `${terrainColor}${cellContent}${this.RESET_COLOR}`;
          }
        }

        // Pad the cell content to the desired width
        if (finalConfig.cellWidth > 1) {
          cellContent = cellContent.padEnd(finalConfig.cellWidth, ' ');
        }

        row += cellContent;

        // Add separator in non-compact view
        if (!finalConfig.compactView && finalConfig.cellWidth === 1) {
          row += ' ';
        }
      }

      lines.push(row);
    }

    return lines.join('\n');
  }

  /**
   * Renders a compact version of the map (default format)
   */
  public static renderCompact(
    map: GameMap,
    unitNames?: Record<string, string>
  ): string {
    return this.render(map, unitNames, { compactView: true, useColors: true });
  }

  /**
   * Renders a detailed version of the map with coordinates
   */
  public static renderDetailed(
    map: GameMap,
    unitNames?: Record<string, string>
  ): string {
    return this.render(map, unitNames, {
      compactView: false,
      showCoordinates: true,
      cellWidth: 2,
      useColors: true,
    });
  }

  /**
   * Renders a legend showing terrain symbols
   */
  public static renderLegend(): string {
    const legendLines: string[] = ['Legend:', '--------'];

    for (const [terrain, symbol] of Object.entries(this.TERRAIN_SYMBOLS)) {
      legendLines.push(`${symbol} = ${terrain}`);
    }

    legendLines.push('? = unknown terrain');
    legendLines.push('Uppercase letters = Units');

    return legendLines.join('\n');
  }

  /**
   * Highlights a specific position on the map
   */
  public static renderWithHighlight(
    map: GameMap,
    highlightPosition: Position,
    highlightSymbol: string = 'X'
  ): string {
    // Temporarily modify the renderer to show highlight
    const lines: string[] = [];
    lines.push(
      `Map: ${map.name} (${map.width}x${map.height}) - Highlighted at (${highlightPosition.x}, ${highlightPosition.y})`
    );
    lines.push('');

    for (let y = 0; y < map.height; y++) {
      let row = `${y.toString().padStart(2, ' ')}|`;

      for (let x = 0; x < map.width; x++) {
        // Check if this is the highlight position
        if (x === highlightPosition.x && y === highlightPosition.y) {
          row += highlightSymbol;
        } else {
          const cell = map.getCell(x, y);
          let cellContent = '';

          // Check for units first
          const unitId = map.getUnitAt(x, y);
          if (unitId) {
            cellContent = unitId.charAt(0).toUpperCase();
          } else {
            // Use terrain symbol
            const terrain = cell ? cell.terrain : 'grass';
            cellContent =
              this.TERRAIN_SYMBOLS[
                terrain as keyof typeof this.TERRAIN_SYMBOLS
              ] || '?';
          }

          row += cellContent;
        }
      }

      lines.push(row);
    }

    return lines.join('\n');
  }

  /**
   * Renders map in fixed terminal area, replacing previous content
   */
  public static renderFixed(
    map: GameMap,
    unitNames?: Record<string, string>,
    config?: Partial<MapRendererConfig>
  ): FixedDisplayState {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    // Calculate the number of lines needed for the display
    const mapHeight = map.height;
    const additionalLines = 3; // For title and empty line
    const totalHeight = mapHeight + additionalLines;

    // Clear the terminal area by moving cursor up and clearing lines
    process.stdout.write('\x1b[2J\x1b[H'); // Clear entire screen and move to top-left

    // Render and output the map
    const mapString = this.render(map, unitNames, finalConfig);
    process.stdout.write(mapString);

    // Return display state information
    return {
      height: totalHeight,
      width: map.width,
      lastRenderTime: Date.now(),
    };
  }

  /**
   * Renders multiple maps in fixed terminal area, replacing previous content
   */
  public static renderMultipleMapsFixed(
    maps: GameMap[],
    unitNames?: Record<string, string>,
    unitPositions?: Record<string, { mapId: string; position: Position }>,
    config?: Partial<MapRendererConfig>
  ): FixedDisplayState {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    // Build the entire display string before rendering
    const allLines: string[] = [];

    // Add title for the entire view
    allLines.push('Game World View');
    allLines.push('===============');

    // Render each map in sequence
    for (const map of maps) {
      allLines.push(`Map: ${map.name} (${map.width}x${map.height})`);

      if (finalConfig?.showCoordinates && !finalConfig?.compactView) {
        // Add X coordinate labels
        let coordLine =
          finalConfig?.cellWidth && finalConfig.cellWidth > 1 ? '    ' : '  ';
        for (let x = 0; x < map.width; x++) {
          const coordStr = x
            .toString()
            .padStart(finalConfig?.cellWidth || 1, ' ');
          coordLine +=
            coordStr +
            (finalConfig?.cellWidth && finalConfig.cellWidth > 1 ? ' ' : '');
        }
        allLines.push(coordLine);
      }

      // Render each row
      for (let y = 0; y < map.height; y++) {
        let row = '';

        if (finalConfig?.showCoordinates) {
          if (finalConfig?.compactView) {
            row += `${y.toString().padStart(2, ' ')}|`;
          } else {
            row += `${y.toString().padStart(2, ' ')} |`;
          }
        }

        for (let x = 0; x < map.width; x++) {
          const cell = map.getCell(x, y);
          let cellContent = '';

          if (finalConfig?.showUnits) {
            const unitId = map.getUnitAt(x, y);
            if (unitId) {
              // Use first character of unit name if available, otherwise use first character of ID
              if (unitNames && unitNames[unitId]) {
                cellContent = unitNames[unitId].charAt(0).toUpperCase();
              } else {
                cellContent = unitId.charAt(0).toUpperCase();
              }
              // Apply unit color if enabled
              if (finalConfig?.useColors) {
                cellContent = `${this.UNIT_COLOR}${cellContent}${this.RESET_COLOR}`;
              }
            }
          }

          if (!cellContent && finalConfig?.showTerrain) {
            const terrain: TerrainType = cell ? cell.terrain : 'grass';
            cellContent = this.TERRAIN_SYMBOLS[terrain] || '?';
            // Apply terrain color if enabled
            if (finalConfig?.useColors) {
              const terrainColor =
                this.TERRAIN_COLORS[terrain] || this.TERRAIN_COLORS.grass;
              cellContent = `${terrainColor}${cellContent}${this.RESET_COLOR}`;
            }
          }

          // Pad the cell content to the desired width
          if (finalConfig?.cellWidth && finalConfig.cellWidth > 1) {
            cellContent = cellContent.padEnd(finalConfig.cellWidth, ' ');
          }

          row += cellContent;

          // Add separator in non-compact view
          if (
            !finalConfig?.compactView &&
            (!finalConfig?.cellWidth || finalConfig.cellWidth === 1)
          ) {
            row += ' ';
          }
        }

        allLines.push(row);
      }

      // Add a blank line between maps
      allLines.push('');
    }

    // Add unit positions information after all maps
    allLines.push('Unit Positions:');
    if (unitPositions) {
      for (const [unitId, posInfo] of Object.entries(unitPositions)) {
        const unitName = unitNames?.[unitId] || unitId;
        allLines.push(
          `  ${unitName} (${unitId.substring(0, 8)}...) is at ${posInfo.mapId} (${posInfo.position.x}, ${posInfo.position.y})`
        );
      }
    }

    // Clear the terminal and write the entire display
    process.stdout.write('\x1b[2J\x1b[H'); // Clear entire screen and move to top-left
    process.stdout.write(allLines.join('\n'));

    // Return display state information
    return {
      height: allLines.length,
      width: Math.max(...maps.map(map => map.width), 0), // Get the width of the widest map
      lastRenderTime: Date.now(),
    };
  }
}
