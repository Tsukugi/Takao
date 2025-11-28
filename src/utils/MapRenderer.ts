/**
 * MapRenderer class for visualizing game maps in console format
 */

import { Map as GameMap, Position } from '@atsu/choukai';

export interface MapRendererConfig {
  showCoordinates: boolean;
  cellWidth: number;
  showUnits: boolean;
  showTerrain: boolean;
  compactView: boolean;
}

export class MapRenderer {
  private static readonly TERRAIN_SYMBOLS: Record<string, string> = {
    grass: '.',
    water: '~',
    mountain: '^',
    forest: 'T',
    desert: '#',
    road: '=',
    plains: '.',
    swamp: ':',
    snow: '*',
    sand: '-',
  };

  private static readonly DEFAULT_CONFIG: MapRendererConfig = {
    showCoordinates: true,
    cellWidth: 1,
    showUnits: true,
    showTerrain: true,
    compactView: true,
  };

  /**
   * Renders a map to console-friendly string representation
   */
  public static render(
    map: GameMap,
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
            // Use first character of unit ID or a special symbol
            cellContent = unitId.charAt(0).toUpperCase();
          }
        }

        if (!cellContent && finalConfig.showTerrain) {
          const terrain = cell ? cell.terrain : 'grass';
          cellContent =
            this.TERRAIN_SYMBOLS[
              terrain as keyof typeof this.TERRAIN_SYMBOLS
            ] || '?';
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
  public static renderCompact(map: GameMap): string {
    return this.render(map, { compactView: true });
  }

  /**
   * Renders a detailed version of the map with coordinates
   */
  public static renderDetailed(map: GameMap): string {
    return this.render(map, {
      compactView: false,
      showCoordinates: true,
      cellWidth: 2,
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
}
