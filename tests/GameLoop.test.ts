import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameLoop } from '../src/core/GameLoop';

describe('GameLoop', () => {
  let gameLoop: GameLoop;

  beforeEach(() => {
    gameLoop = new GameLoop();
  });

  afterEach(() => {
    gameLoop.stop(); // Ensure clean state
  });

  it('initializes in stopped state', () => {
    expect(gameLoop.getRunning()).toBe(false);
  });

  it('tracks turn count correctly', () => {
    expect(gameLoop.getTurn()).toBe(0);

    // Simulate a turn by manually calling the start-stop cycle
    const callback = vi.fn();
    gameLoop.start(callback);
    gameLoop.stop();

    // After starting and stopping, turn should still be 0 initially
    expect(gameLoop.getTurn()).toBe(0);
  });

  it('sets turn interval correctly', () => {
    gameLoop.setTurnInterval(3000);
    expect(gameLoop.getTurnInterval()).toBe(3000);
  });

  it('starts the game loop correctly', () => {
    const callback = vi.fn();

    gameLoop.start(callback);

    expect(gameLoop.getRunning()).toBe(true);
  });

  it('stops the game loop correctly', () => {
    const callback = vi.fn();
    gameLoop.start(callback);

    expect(gameLoop.getRunning()).toBe(true);

    gameLoop.stop();

    expect(gameLoop.getRunning()).toBe(false);
  });

  it('does not start if already running', () => {
    const callback = vi.fn();
    gameLoop.start(callback);

    expect(gameLoop.getRunning()).toBe(true);

    // Try to start again - should show warning in console but stay running
    gameLoop.start(vi.fn());

    expect(gameLoop.getRunning()).toBe(true);
  });

  it('returns correct running state at all times', () => {
    expect(gameLoop.getRunning()).toBe(false);

    gameLoop.start(vi.fn());
    expect(gameLoop.getRunning()).toBe(true);

    gameLoop.stop();
    expect(gameLoop.getRunning()).toBe(false);
  });
});
