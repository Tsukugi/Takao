import type { RandomValue } from './index';

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
