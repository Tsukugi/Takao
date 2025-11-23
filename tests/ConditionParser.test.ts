import { describe, it, expect } from 'vitest';
import { ConditionParser } from '../src/utils/ConditionParser';

describe('ConditionParser', () => {
  describe('evaluateCondition', () => {
    it('should evaluate <= condition correctly', () => {
      expect(ConditionParser.evaluateCondition('health <= 30', 20)).toBe(true);
      expect(ConditionParser.evaluateCondition('health <= 30', 30)).toBe(true);
      expect(ConditionParser.evaluateCondition('health <= 30', 40)).toBe(false);
    });

    it('should evaluate >= condition correctly', () => {
      expect(ConditionParser.evaluateCondition('mana >= 50', 60)).toBe(true);
      expect(ConditionParser.evaluateCondition('mana >= 50', 50)).toBe(true);
      expect(ConditionParser.evaluateCondition('mana >= 50', 40)).toBe(false);
    });

    it('should evaluate < condition correctly', () => {
      expect(ConditionParser.evaluateCondition('stamina < 100', 99)).toBe(true);
      expect(ConditionParser.evaluateCondition('stamina < 100', 100)).toBe(
        false
      );
      expect(ConditionParser.evaluateCondition('stamina < 100', 101)).toBe(
        false
      );
    });

    it('should evaluate > condition correctly', () => {
      expect(ConditionParser.evaluateCondition('attack > 25', 30)).toBe(true);
      expect(ConditionParser.evaluateCondition('attack > 25', 25)).toBe(false);
      expect(ConditionParser.evaluateCondition('attack > 25', 20)).toBe(false);
    });

    it('should handle conditions with spaces around operators', () => {
      expect(ConditionParser.evaluateCondition('health <= 30', 25)).toBe(true);
      expect(ConditionParser.evaluateCondition('mana >= 40', 45)).toBe(true);
      expect(ConditionParser.evaluateCondition('stamina < 100', 50)).toBe(true);
      expect(ConditionParser.evaluateCondition('attack > 20', 25)).toBe(true);
    });

    it('should return false for invalid or malformed conditions', () => {
      expect(ConditionParser.evaluateCondition('invalid condition', 50)).toBe(
        false
      );
      expect(ConditionParser.evaluateCondition('health === 30', 30)).toBe(
        false
      );
      expect(ConditionParser.evaluateCondition('', 30)).toBe(false);
      expect(
        ConditionParser.evaluateCondition('health <= notANumber', 30)
      ).toBe(false);
      expect(ConditionParser.evaluateCondition('health <=', 30)).toBe(false);
    });

    it('should handle edge cases with threshold values', () => {
      // Test with 0 threshold
      expect(ConditionParser.evaluateCondition('health <= 0', 0)).toBe(true);
      expect(ConditionParser.evaluateCondition('health < 0', 0)).toBe(false);
      expect(ConditionParser.evaluateCondition('health >= 0', 0)).toBe(true);
      expect(ConditionParser.evaluateCondition('health > 0', 0)).toBe(false);

      // Test with negative values
      expect(ConditionParser.evaluateCondition('health <= -10', -15)).toBe(
        true
      );
      expect(ConditionParser.evaluateCondition('health >= -10', -5)).toBe(true);
      expect(ConditionParser.evaluateCondition('health < -5', -10)).toBe(true);
      expect(ConditionParser.evaluateCondition('health > -5', -10)).toBe(false);
    });
  });
});
