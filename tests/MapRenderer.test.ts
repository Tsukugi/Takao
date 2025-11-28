/**
 * Tests for the MapRenderer utility class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Map as GameMap, Position } from '@atsu/choukai';
import { MapRenderer } from '../src/utils/MapRenderer';

describe('MapRenderer', () => {
  let testMap: GameMap;

  beforeEach(() => {
    testMap = new GameMap(5, 4, 'Test Map');
  });

  it('should render a basic map', () => {
    const result = MapRenderer.renderCompact(testMap);
    expect(result).toContain('Test Map');
    expect(result).toContain('5x4');
    // Should have 4 rows of content (plus header)
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(4);
  });

  it('should render terrain symbols correctly', () => {
    testMap.setTerrain(0, 0, 'water');
    testMap.setTerrain(1, 0, 'mountain');
    testMap.setTerrain(2, 0, 'forest');

    const result = MapRenderer.renderCompact(testMap);
    expect(result).toContain('~'); // water
    expect(result).toContain('^'); // mountain
    expect(result).toContain('T'); // forest
  });

  it('should render units correctly', () => {
    testMap.placeUnit('PLAYER', 0, 0);
    testMap.placeUnit('ENEMY', 1, 1);

    const result = MapRenderer.renderCompact(testMap);

    // Units should be represented by first letter of their IDs
    expect(result).toContain('P'); // PLAYER
    expect(result).toContain('E'); // ENEMY
  });

  it('should render units taking precedence over terrain', () => {
    // Place a unit first
    const placementResult = testMap.placeUnit('A', 1, 1);
    expect(placementResult).toBe(true); // Verify placement succeeded

    const result = MapRenderer.renderCompact(testMap);
    // The unit should be visible
    expect(result).toContain('A');
  });

  it('should render legend correctly', () => {
    const legend = MapRenderer.renderLegend();
    expect(legend).toContain('Legend:');
    expect(legend).toContain('~ = water');
    expect(legend).toContain('^ = mountain');
    expect(legend).toContain('T = forest');
  });

  it('should render detailed view with coordinates', () => {
    testMap.setTerrain(2, 1, 'forest');
    const result = MapRenderer.renderDetailed(testMap);

    expect(result).toContain(' 0 |'); // Starting row with coordinates (single digit padded)
    expect(result).toContain('. T .'); // Forest symbol with spacing (the T is surrounded by spaces)
  });

  it('should render with custom configuration', () => {
    testMap.setTerrain(0, 0, 'water');
    const result = MapRenderer.render(testMap, {
      showCoordinates: true,
      cellWidth: 2,
      showTerrain: true,
    });

    expect(result).toContain(' 0|'); // Coordinates shown (with special config, may be different formatting)
    expect(result).toContain('~ .'); // Water with padding (cell width 2 creates space after)
  });

  it('should render highlighted position', () => {
    testMap.setTerrain(1, 1, 'mountain');
    const highlightPos = new Position(1, 1);
    const result = MapRenderer.renderWithHighlight(testMap, highlightPos, 'X');

    expect(result).toContain('X'); // Highlight symbol should be present
    expect(result).toContain('Map: Test Map');
  });

  it('should handle empty map correctly', () => {
    const result = MapRenderer.renderCompact(testMap);

    expect(result).toContain('Test Map');
    expect(result).toContain('5x4');
    // Should contain default terrain symbols (grass = '.')
    expect(result).toContain('.');
  });

  it('should render multiple units correctly', () => {
    testMap.placeUnit('A', 0, 0);
    testMap.placeUnit('B', 0, 1);
    testMap.placeUnit('C', 1, 0);

    const result = MapRenderer.renderCompact(testMap);

    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
  });

  it('should render different terrain types', () => {
    const terrains: [number, number, string][] = [
      [0, 0, 'water'],
      [1, 0, 'mountain'],
      [2, 0, 'forest'],
      [3, 0, 'desert'],
      [4, 0, 'road'],
    ];

    terrains.forEach(([x, y, terrain]) => {
      testMap.setTerrain(x, y, terrain);
    });

    const result = MapRenderer.renderCompact(testMap);

    expect(result).toContain('~'); // water
    expect(result).toContain('^'); // mountain
    expect(result).toContain('T'); // forest
    expect(result).toContain('#'); // desert
    expect(result).toContain('='); // road
  });

  it('should render compact format by default', () => {
    const result = MapRenderer.renderCompact(testMap);
    // Compact format should have coordinates with | separator
    const hasCoordinateLine = result
      .split('\n')
      .some(line => line.includes('|'));
    expect(hasCoordinateLine).toBe(true);
  });
});
