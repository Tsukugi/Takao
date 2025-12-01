import { MathUtils } from '../src/utils/Math';
import { describe, it, expect } from 'vitest';

describe('MathUtils', () => {
  describe('getRandomFromArray', () => {
    it('should return an element from the provided array', () => {
      const testArray = [1, 2, 3, 4, 5];
      const randomElement = MathUtils.getRandomFromArray(testArray);

      expect(testArray).toContain(randomElement);
    });

    it('should return the only element from single-element array', () => {
      const singleElementArray = ['only-element'];
      const randomElement = MathUtils.getRandomFromArray(singleElementArray);

      expect(randomElement).toBe('only-element');
    });

    it('should return undefined for an empty array', () => {
      const emptyArray: any[] = [];
      const randomElement = MathUtils.getRandomFromArray(emptyArray);

      // When array is empty, accessing arr[randomIndex] when randomIndex=0 will return undefined
      expect(randomElement).toBeUndefined();
    });

    it('should work with arrays of different types', () => {
      // Test with string array
      const stringArray = ['a', 'b', 'c'];
      const randomString = MathUtils.getRandomFromArray(stringArray);
      expect(stringArray).toContain(randomString);

      // Test with number array
      const numberArray = [10, 20, 30];
      const randomNumber = MathUtils.getRandomFromArray(numberArray);
      expect(numberArray).toContain(randomNumber);

      // Test with object array
      const objectArray = [{ id: 1 }, { id: 2 }];
      const randomObject = MathUtils.getRandomFromArray(objectArray);
      expect(objectArray).toContain(randomObject);
    });
  });

  describe('getRandomNumber', () => {
    it('should return a number within the specified range (inclusive)', () => {
      const min = 5;
      const max = 10;
      const randomNumber = MathUtils.getRandomNumber(min, max);

      expect(randomNumber).toBeGreaterThanOrEqual(min);
      expect(randomNumber).toBeLessThanOrEqual(max);
      expect(Number.isInteger(randomNumber)).toBe(true);
    });

    it('should return the same number when min and max are equal', () => {
      const minMax = 7;
      const randomNumber = MathUtils.getRandomNumber(minMax, minMax);

      expect(randomNumber).toBe(minMax);
    });

    it('should handle negative ranges correctly', () => {
      const min = -10;
      const max = -5;
      const randomNumber = MathUtils.getRandomNumber(min, max);

      expect(randomNumber).toBeGreaterThanOrEqual(min);
      expect(randomNumber).toBeLessThanOrEqual(max);
      expect(Number.isInteger(randomNumber)).toBe(true);
    });

    it('should handle ranges crossing zero correctly', () => {
      const min = -5;
      const max = 5;
      const randomNumber = MathUtils.getRandomNumber(min, max);

      expect(randomNumber).toBeGreaterThanOrEqual(min);
      expect(randomNumber).toBeLessThanOrEqual(max);
      expect(Number.isInteger(randomNumber)).toBe(true);
    });

    it('should work with range of 0 to positive number', () => {
      const min = 0;
      const max = 100;
      const randomNumber = MathUtils.getRandomNumber(min, max);

      expect(randomNumber).toBeGreaterThanOrEqual(min);
      expect(randomNumber).toBeLessThanOrEqual(max);
      expect(Number.isInteger(randomNumber)).toBe(true);
    });
  });

  describe('repeated calls', () => {
    it('getRandomFromArray should return different elements on repeated calls', () => {
      // This is a probabilistic test - it's highly unlikely to return the same element every time
      const testArray = [1, 2, 3, 4, 5];
      const results = [];

      // Call function multiple times and collect results
      for (let i = 0; i < 10; i++) {
        results.push(MathUtils.getRandomFromArray(testArray));
      }

      // With a low probability this could fail due to randomness, but it's very unlikely
      const uniqueResults = new Set(results);
      // We allow the possibility of some repeats but expect multiple unique values in most cases
      expect(uniqueResults.size).toBeGreaterThan(1); // At least 2 different values expected
    });

    it('getRandomNumber should return different numbers on repeated calls', () => {
      // This is a probabilistic test
      const results = [];

      // Call function multiple times and collect results
      for (let i = 0; i < 20; i++) {
        results.push(MathUtils.getRandomNumber(1, 10));
      }

      // With a low probability this could fail due to randomness, but it's very unlikely
      const uniqueResults = new Set(results);
      // We expect many different values in the range
      expect(uniqueResults.size).toBeGreaterThan(1); // At least 2 different values expected
    });
  });
});
