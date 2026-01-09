import {
  isUnitPosition as atagoIsUnitPosition,
  isPosition as atagoIsPosition,
} from '@atsu/atago';
import type {
  IProperty,
  IPropertyCollection,
  PropertyMap,
  PropertyScalar,
  PropertyValue,
} from '@atsu/atago';
import type { IMapPosition } from '@atsu/choukai';
import type {
  ComparisonRequirement,
  RandomValue,
  Requirement,
  UnitDefinition,
} from './index';

export const isRandomValue = (value: unknown): value is RandomValue =>
  typeof value === 'object' &&
  value !== null &&
  (value as { type?: string }).type === 'random';

export const isObject = (value: unknown): value is object =>
  value != null && typeof value === 'object';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const isString = (value: unknown): value is string =>
  typeof value === 'string';

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number';

export const isMapPosition = (value: unknown): value is IMapPosition => {
  if (!isRecord(value)) {
    return false;
  }

  if (!isString(value.mapId)) {
    return false;
  }

  if (!isRecord(value.position)) {
    return false;
  }

  if (!isNumber(value.position.x) || !Number.isFinite(value.position.x)) {
    return false;
  }

  if (!isNumber(value.position.y) || !Number.isFinite(value.position.y)) {
    return false;
  }

  return true;
};

export const isMovementPath = (value: unknown): value is IMapPosition[] =>
  Array.isArray(value) && value.every(isMapPosition);

const isPropertyScalar = (value: unknown): value is PropertyScalar =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

const isPropertyMap = (value: unknown): value is PropertyMap =>
  isRecord(value) && Object.values(value).every(isPropertyScalar);

const isPropertyValue = (value: unknown): value is PropertyValue =>
  isPropertyScalar(value) || atagoIsUnitPosition(value) || isPropertyMap(value);

const isPropertyModifier = (
  value: unknown
): value is { source: string; value: PropertyValue; priority?: number } => {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.source !== 'string') {
    return false;
  }

  if (!('value' in value)) {
    return false;
  }

  if (!isPropertyValue(value.value)) {
    return false;
  }

  if (value.priority !== undefined && typeof value.priority !== 'number') {
    return false;
  }

  return true;
};

const isProperty = (value: unknown): value is IProperty<PropertyValue> => {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.name !== 'string') {
    return false;
  }

  if (!('value' in value)) {
    return false;
  }

  if (!isPropertyValue(value.value)) {
    return false;
  }

  if (value.baseValue !== undefined && !isPropertyValue(value.baseValue)) {
    return false;
  }

  if (value.modifiers !== undefined) {
    if (!Array.isArray(value.modifiers)) {
      return false;
    }
    if (!value.modifiers.every(isPropertyModifier)) {
      return false;
    }
  }

  if (value.readonly !== undefined && typeof value.readonly !== 'boolean') {
    return false;
  }

  return true;
};

const isPropertyCollection = (value: unknown): value is IPropertyCollection => {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every(isProperty);
};

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

export const isUnitDefinition = (value: unknown): value is UnitDefinition => {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.id !== 'string') {
    return false;
  }

  if (typeof value.name !== 'string') {
    return false;
  }

  if (typeof value.type !== 'string') {
    return false;
  }

  if (!('properties' in value)) {
    return false;
  }

  if (!isPropertyCollection(value.properties)) {
    return false;
  }

  return true;
};

export const isBestiaryData = (value: unknown): value is UnitDefinition[] =>
  Array.isArray(value) && value.every(isUnitDefinition);
