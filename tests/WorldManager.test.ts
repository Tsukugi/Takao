import {
  World as ChoukaiWorld,
  Map as ChoukaiMap,
  Position,
} from '@atsu/choukai';
import { WorldManager } from '../src/core/WorldManager';
import { describe, it, expect, beforeEach } from 'vitest';

describe('WorldManager', () => {
  let world: ChoukaiWorld;

  beforeEach(() => {
    world = new ChoukaiWorld();
  });

  describe('constructor', () => {
    it('should create a new WorldManager instance with the provided world', () => {
      const worldManager = new WorldManager(world);
      expect(worldManager).toBeInstanceOf(WorldManager);
      expect(worldManager.getWorld()).toBe(world);
    });
  });

  describe('createMap', () => {
    it('should create a new map with specified dimensions and name', () => {
      const worldManager = new WorldManager(world);
      const map = worldManager.createMap(10, 5, 'Test Map');

      expect(map).toBeInstanceOf(ChoukaiMap);
      expect(map.width).toBe(10);
      expect(map.height).toBe(5);
      expect(map.name).toBe('Test Map');
    });

    it('should create a map with zero dimensions', () => {
      const worldManager = new WorldManager(world);
      const map = worldManager.createMap(0, 0, 'Zero Map');

      expect(map).toBeInstanceOf(ChoukaiMap);
      expect(map.width).toBe(0);
      expect(map.height).toBe(0);
      expect(map.name).toBe('Zero Map');
    });

    it('should create maps with different names correctly', () => {
      const worldManager = new WorldManager(world);

      const map1 = worldManager.createMap(5, 5, 'Map One');
      const map2 = worldManager.createMap(5, 5, 'Map Two');

      expect(map1.name).toBe('Map One');
      expect(map2.name).toBe('Map Two');
      expect(map1.width).toBe(5);
      expect(map2.width).toBe(5);
      expect(map1.height).toBe(5);
      expect(map2.height).toBe(5);
    });
  });

  describe('createWorld', () => {
    it('should create a new world instance', () => {
      const worldManager = new WorldManager(world);
      const newWorld = worldManager.createWorld();

      expect(newWorld).toBeInstanceOf(ChoukaiWorld);
    });

    it('should create an independent world instance', () => {
      const worldManager = new WorldManager(world);
      const newWorld = worldManager.createWorld();

      expect(newWorld).toBeInstanceOf(ChoukaiWorld);
      expect(newWorld).not.toBe(world); // Different instance
    });

    it('should create an empty world', () => {
      const worldManager = new WorldManager(world);
      const newWorld = worldManager.createWorld();

      expect(newWorld.getAllMaps()).toHaveLength(0);
    });
  });

  describe('getRandomPosition', () => {
    it('should return a position within the map bounds', () => {
      const worldManager = new WorldManager(world);
      const map = new ChoukaiMap(10, 5, 'Test Map');

      const position = worldManager.getRandomPosition(map);

      expect(position).toBeInstanceOf(Position);
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.x).toBeLessThan(10);
      expect(position.y).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeLessThan(5);
    });

    it('should return a position with valid coordinates for a 1x1 map', () => {
      const worldManager = new WorldManager(world);
      const map = new ChoukaiMap(1, 1, 'Tiny Map');

      const position = worldManager.getRandomPosition(map);

      expect(position).toBeInstanceOf(Position);
      expect(position.x).toBe(0); // Only possible value
      expect(position.y).toBe(0); // Only possible value
    });

    it('should return a position with valid coordinates for a larger map', () => {
      const worldManager = new WorldManager(world);
      const map = new ChoukaiMap(100, 100, 'Large Map');

      const position = worldManager.getRandomPosition(map);

      expect(position).toBeInstanceOf(Position);
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.x).toBeLessThan(100);
      expect(position.y).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeLessThan(100);
    });
  });

  describe('getWorld', () => {
    it('should return the world instance passed to the constructor', () => {
      const worldManager = new WorldManager(world);

      const returnedWorld = worldManager.getWorld();

      expect(returnedWorld).toBe(world);
    });

    it('should always return the same world instance', () => {
      const worldManager = new WorldManager(world);

      const returnedWorld1 = worldManager.getWorld();
      const returnedWorld2 = worldManager.getWorld();

      expect(returnedWorld1).toBe(returnedWorld2);
      expect(returnedWorld1).toBe(world);
    });
  });
});
