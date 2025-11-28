import type { IPosition, IUnitPosition } from '@atsu/choukai';
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

export const isPosition = (value: unknown): value is IPosition =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { x: unknown }).x === 'number' &&
  typeof (value as { y: unknown }).y === 'number';

export const isUnitPosition = (value: unknown): value is IUnitPosition =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IUnitPosition).unitId === 'string' &&
  typeof (value as IUnitPosition).mapId === 'string' &&
  typeof (value as IUnitPosition).position === 'object' &&
  (value as IUnitPosition).position !== null &&
  typeof (value as IUnitPosition).position.x === 'number' &&
  typeof (value as IUnitPosition).position.y === 'number';
