/**
 * Tests for the MathUtils utility functions
 */

import { describe, it, expect } from 'vitest';
import { MathUtils } from '../src/utils/Math';

describe('MathUtils', () => {
  describe('getRandomFromArray', () => {
    it('should return a random element from the array', () => {
      const testArray = ['apple', 'banana', 'cherry', 'date'];
      const result = MathUtils.getRandomFromArray(testArray);

      expect(testArray).toContain(result);
    });

    it('should return the only element from a single-element array', () => {
      const singleElementArray = ['only'];
      const result = MathUtils.getRandomFromArray(singleElementArray);

      expect(result).toBe('only');
    });

    it('should work with numbers array', () => {
      const numbers = [1, 2, 3, 4, 5];
      const result = MathUtils.getRandomFromArray(numbers);

      expect(numbers).toContain(result);
      expect(typeof result).toBe('number');
    });

    it('should work with mixed type arrays', () => {
      const mixedArray = [1, 'hello', true, { id: 1 }];
      const result = MathUtils.getRandomFromArray(mixedArray);

      expect(mixedArray).toContainEqual(result);
    });

    it('should return undefined for empty array', () => {
      const emptyArray: any[] = [];
      const result = MathUtils.getRandomFromArray(emptyArray);

      // When the array is empty, arr[0] will be undefined since Math.floor(Math.random() * 0) = 0
      // and accessing index 0 of an empty array returns undefined
      expect(result).toBeUndefined();
    });
  });

  describe('getRandomNumber', () => {
    it('should return a random integer within the specified range (inclusive)', () => {
      const min = 5;
      const max = 10;

      for (let i = 0; i < 100; i++) {
        const result = MathUtils.getRandomNumber(min, max);

        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should return the same number when min and max are equal', () => {
      const result = MathUtils.getRandomNumber(42, 42);
      expect(result).toBe(42);
    });

    it('should work with negative numbers', () => {
      const min = -10;
      const max = -5;

      // Test a few calls to verify it works with negative numbers
      for (let i = 0; i < 5; i++) {
        const result = MathUtils.getRandomNumber(min, max);

        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should work with negative to positive range', () => {
      const min = -5;
      const max = 5;

      // Test a few calls to verify it works with mixed range
      for (let i = 0; i < 5; i++) {
        const result = MathUtils.getRandomNumber(min, max);

        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should handle range of 0 to n', () => {
      const min = 0;
      const max = 100;

      // Test a few calls to verify it works with positive range
      for (let i = 0; i < 5; i++) {
        const result = MathUtils.getRandomNumber(min, max);

        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
        expect(Number.isInteger(result)).toBe(true);
      }
    });
  });

  describe('Consistency checks', () => {
    it('getRandomFromArray should return valid values', () => {
      const testArray = [1, 2, 3, 4, 5];

      // Test a few calls to ensure they return valid results
      for (let i = 0; i < 5; i++) {
        const result = MathUtils.getRandomFromArray(testArray);
        expect(testArray).toContain(result);
      }
    });

    it('getRandomNumber should return values within range', () => {
      // Test a few calls to ensure they return values in range
      for (let i = 0; i < 5; i++) {
        const result = MathUtils.getRandomNumber(1, 10);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(10);
        expect(Number.isInteger(result)).toBe(true);
      }
    });
  });
});
