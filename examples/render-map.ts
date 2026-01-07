/**
 * Example: Map Rendering Usage
 *
 * Demonstrates a lightweight ASCII renderer for visualizing game maps
 * with terrain and unit overlays.
 */

import { BaseUnit, type IUnitPosition } from '@atsu/atago';
import { Map as GameMap, Position, type TerrainType } from '@atsu/choukai';

console.log('=== Takao Engine - Map Rendering Example ===\n');

const TERRAIN_SYMBOLS: Record<TerrainType, string> = {
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

const setUnitPosition = (
  unit: BaseUnit,
  mapId: string,
  x: number,
  y: number
) => {
  unit.setProperty('position', {
    unitId: unit.id,
    mapId,
    position: new Position(x, y),
  });
};

const buildUnitLookup = (units: BaseUnit[], mapName: string) => {
  const lookup = new Map<string, BaseUnit>();
  for (const unit of units) {
    const unitPosition = unit.getPropertyValue<IUnitPosition>('position');
    if (unitPosition?.mapId !== mapName) continue;
    lookup.set(`${unitPosition.position.x},${unitPosition.position.y}`, unit);
  }
  return lookup;
};

const getUnitSymbol = (unit: BaseUnit) => {
  const label = unit.name || unit.id;
  return label.charAt(0).toUpperCase();
};

interface RenderOptions {
  showCoordinates?: boolean;
  cellWidth?: number;
  highlight?: { x: number; y: number; symbol?: string };
}

const renderMap = (
  map: GameMap,
  units: BaseUnit[],
  options: RenderOptions = {}
): string => {
  const { showCoordinates = false, cellWidth = 1, highlight } = options;
  const unitLookup = buildUnitLookup(units, map.name);
  const coordWidth = showCoordinates
    ? Math.max(2, String(map.height - 1).length)
    : 0;

  const lines: string[] = [];

  for (let y = 0; y < map.height; y++) {
    let line = '';

    if (showCoordinates) {
      line += `${String(y).padStart(coordWidth, ' ')} | `;
    }

    for (let x = 0; x < map.width; x++) {
      let symbol = '';

      if (highlight && highlight.x === x && highlight.y === y) {
        symbol = highlight.symbol || '@';
      } else {
        const unit = unitLookup.get(`${x},${y}`);
        if (unit) {
          symbol = getUnitSymbol(unit);
        } else {
          const cell = map.getCell(x, y);
          const terrain = cell?.terrain || 'grass';
          symbol = TERRAIN_SYMBOLS[terrain] || '?';
        }
      }

      if (cellWidth > 1) {
        line += symbol.padEnd(cellWidth, ' ');
      } else {
        line += symbol;
      }
    }

    lines.push(line);
  }

  return lines.join('\n');
};

const renderCompact = (map: GameMap, units: BaseUnit[]) =>
  renderMap(map, units, { showCoordinates: false, cellWidth: 1 });

const renderDetailed = (map: GameMap, units: BaseUnit[]) =>
  renderMap(map, units, { showCoordinates: true, cellWidth: 2 });

const renderWithHighlight = (
  map: GameMap,
  units: BaseUnit[],
  position: Position,
  symbol: string
) =>
  renderMap(map, units, {
    showCoordinates: true,
    cellWidth: 1,
    highlight: { x: position.x, y: position.y, symbol },
  });

const renderLegend = (): string =>
  Object.entries(TERRAIN_SYMBOLS)
    .map(([terrain, symbol]) => `${symbol} = ${terrain}`)
    .join('\n');

// Create a sample map
const gameMap = new GameMap(15, 10, 'Example Realm');

// Add some terrain
gameMap.setTerrain(3, 3, 'water');
gameMap.setTerrain(4, 3, 'water');
gameMap.setTerrain(3, 4, 'water');
gameMap.setTerrain(5, 5, 'mountain');
gameMap.setTerrain(6, 5, 'mountain');
gameMap.setTerrain(7, 7, 'forest');
gameMap.setTerrain(8, 7, 'forest');
gameMap.setTerrain(9, 7, 'forest');
gameMap.setTerrain(2, 8, 'desert');
gameMap.setTerrain(12, 2, 'road');

// Place some units
const playerUnit = new BaseUnit('P', 'Player', 'hero');
const enemyUnit = new BaseUnit('E', 'Enemy', 'enemy');
const npcUnit = new BaseUnit('N', 'NPC', 'npc');
setUnitPosition(playerUnit, gameMap.name, 2, 2);
setUnitPosition(enemyUnit, gameMap.name, 8, 2);
setUnitPosition(npcUnit, gameMap.name, 10, 5);
const units = [playerUnit, enemyUnit, npcUnit];

console.log('Compact Render:');
console.log(renderCompact(gameMap, units));
console.log('');

console.log('Detailed Render:');
console.log(renderDetailed(gameMap, units));
console.log('');

console.log('Custom Config Render (showing coordinates):');
console.log(renderMap(gameMap, units, { showCoordinates: true, cellWidth: 1 }));
console.log('');

console.log('With Highlight:');
console.log(renderWithHighlight(gameMap, units, new Position(5, 5), '@'));
console.log('');

console.log('Legend:');
console.log(renderLegend());
console.log('');

// Create another map with more complex terrain
const complexMap = new GameMap(20, 12, 'Complex Terrain');

// Generate some interesting terrain
for (let x = 0; x < 5; x++) {
  for (let y = 0; y < 5; y++) {
    complexMap.setTerrain(x, y, 'water');
  }
}

for (let x = 10; x < 15; x++) {
  for (let y = 5; y < 10; y++) {
    complexMap.setTerrain(x, y, 'mountain');
  }
}

for (let x = 5; x < 10; x++) {
  complexMap.setTerrain(x, 7, 'road');
}

// Place multiple units
const unitA = new BaseUnit('A', 'Alpha', 'npc');
const unitB = new BaseUnit('B', 'Bravo', 'npc');
const unitC = new BaseUnit('C', 'Charlie', 'npc');
setUnitPosition(unitA, complexMap.name, 1, 1);
setUnitPosition(unitB, complexMap.name, 12, 6);
setUnitPosition(unitC, complexMap.name, 6, 8);
const complexUnits = [unitA, unitB, unitC];

console.log('Complex Map Render:');
console.log(renderCompact(complexMap, complexUnits));
console.log('');
console.log('Complex Map Legend:');
console.log(renderLegend());

console.log('\n=== Map Rendering Example Completed ===');
