/**
 * Tests for the enhanced StoryTeller with Gate System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StoryTeller } from '../src/core/StoryTeller';
import { UnitController } from '../src/ai/UnitController';

describe('StoryTeller Gate System', () => {
  let storyTeller: StoryTeller;
  let unitController: UnitController;
  let worldManager: ReturnType<StoryTeller['getWorldManager']>;

  beforeEach(async () => {
    unitController = new UnitController();
    await unitController.initialize({ turn: 0 });
    storyTeller = new StoryTeller(unitController);
    worldManager = storyTeller.getWorldManager();
  });

  it('should initialize with a GateSystem', () => {
    expect(worldManager).toBeDefined();
  });

  it('should add and manage gates', () => {
    const gate = {
      mapFrom: 'Map1',
      positionFrom: { x: 5, y: 5 },
      mapTo: 'Map2',
      positionTo: { x: 3, y: 3 },
      name: 'Portal1',
      bidirectional: true,
    };

    const success = worldManager.addGate(gate);
    expect(success).toBe(true);

    // Verify that the gate was added
    const hasGate = worldManager.hasGate('Map1', 5, 5);
    expect(hasGate).toBe(true);

    // Verify that the gate destination is correct
    const destination = worldManager.getGateDestination('Map1', 5, 5);
    expect(destination).toBeDefined();
    expect(destination!.mapTo).toBe('Map2');
    expect(destination!.positionTo.x).toBe(3);
    expect(destination!.positionTo.y).toBe(3);
  });

  it('should create bidirectional gates properly', () => {
    const gate = {
      mapFrom: 'MapA',
      positionFrom: { x: 0, y: 0 },
      mapTo: 'MapB',
      positionTo: { x: 9, y: 9 },
      name: 'Gateway',
      bidirectional: true,
    };

    const success = worldManager.addGate(gate);
    expect(success).toBe(true);

    // Check forward gate
    const forwardDest = worldManager.getGateDestination('MapA', 0, 0);
    expect(forwardDest).toBeDefined();
    expect(forwardDest!.mapTo).toBe('MapB');

    // Check reverse gate exists
    const reverseDest = worldManager.getGateDestination('MapB', 9, 9);
    expect(reverseDest).toBeDefined();
    expect(reverseDest!.mapTo).toBe('MapA');
  });

  it('should remove gates', () => {
    const gate = {
      mapFrom: 'TestMap',
      positionFrom: { x: 2, y: 2 },
      mapTo: 'OtherMap',
      positionTo: { x: 4, y: 4 },
      name: 'ToRemove',
      bidirectional: false,
    };

    const addSuccess = worldManager.addGate(gate);
    expect(addSuccess).toBe(true);

    // Verify gate exists
    const hasGateBefore = worldManager.hasGate('TestMap', 2, 2);
    expect(hasGateBefore).toBe(true);

    // Remove the gate
    const removeSuccess = worldManager.removeGate('ToRemove');
    expect(removeSuccess).toBe(true);

    // Verify gate no longer exists
    const hasGateAfter = worldManager.hasGate('TestMap', 2, 2);
    expect(hasGateAfter).toBe(false);
  });

  it('should get all gates for a map', () => {
    const gate1 = {
      mapFrom: 'SourceMap',
      positionFrom: { x: 1, y: 1 },
      mapTo: 'DestMap1',
      positionTo: { x: 2, y: 2 },
      name: 'Gate1',
      bidirectional: false,
    };

    const gate2 = {
      mapFrom: 'SourceMap',
      positionFrom: { x: 5, y: 5 },
      mapTo: 'DestMap2',
      positionTo: { x: 3, y: 3 },
      name: 'Gate2',
      bidirectional: false,
    };

    worldManager.addGate(gate1);
    worldManager.addGate(gate2);

    const gatesForMap = worldManager.getGatesForMap('SourceMap');
    expect(gatesForMap.length).toBe(2);
    expect(gatesForMap.some(g => g.name === 'Gate1')).toBe(true);
    expect(gatesForMap.some(g => g.name === 'Gate2')).toBe(true);
  });

  it('should get all gates in the system', () => {
    const gate = {
      mapFrom: 'TestMap1',
      positionFrom: { x: 0, y: 0 },
      mapTo: 'TestMap2',
      positionTo: { x: 1, y: 1 },
      name: 'SystemGate',
      bidirectional: true,
    };

    worldManager.addGate(gate);
    const allGates = worldManager.getAllGates();

    // Should have both forward and reverse gates due to bidirectional
    expect(allGates.length).toBe(2);
    expect(allGates.some(g => g.name === 'SystemGate')).toBe(true);
    expect(allGates.some(g => g.name.includes('reverse'))).toBe(true);
  });

  it('should return undefined for nonexistent gates', () => {
    const destination = worldManager.getGateDestination('NonexistentMap', 0, 0);
    expect(destination).toBeUndefined();
  });
});
