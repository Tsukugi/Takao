import {
  isUnitPosition as atagoIsUnitPosition,
  isPosition as atagoIsPosition,
} from '@atsu/atago';
import type { ComparisonRequirement, RandomValue, Requirement } from './index';

export const isRandomValue = (value: unknown): value is RandomValue =>
  typeof value === 'object' &&
  value !== null &&
  (value as { type?: string }).type === 'random';

export const isObject = (value: unknown): value is object =>
  value != null && typeof value === 'object';

export const isString = (value: unknown): value is string =>
  typeof value === 'string';

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number';

export const isComparison = (
  value: unknown
): value is ComparisonRequirement => {
  if (!isObject(value)) {
    return false;
  }
  const req = value as Requirement;
  if (typeof req.type !== 'string' || typeof req.value !== 'number') {
    return false;
  }
  return req.type === 'comparison';
};

export const isPosition = atagoIsPosition;
export const isUnitPosition = atagoIsUnitPosition;
