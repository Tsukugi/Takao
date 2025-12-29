import { isString } from '../types/typeGuards';
import type { ActionPayload } from '../types';

type PayloadWithTargetId =
  | { targetUnitId: unknown }
  | { unitId: unknown }
  | { targetUnit: unknown }
  | { target: unknown };

export const targetFromPayload = (
  payload: ActionPayload | undefined
): string | null => {
  if (!payload) return null;

  if ('targetUnit' in payload && isString(payload.targetUnit)) {
    return payload.targetUnit;
  }

  if ('target' in payload && isString(payload.target)) {
    return payload.target;
  }

  const candidate = payload as PayloadWithTargetId;

  if ('targetUnitId' in candidate && isString(candidate.targetUnitId)) {
    return candidate.targetUnitId;
  }

  if ('unitId' in candidate && isString(candidate.unitId)) {
    return candidate.unitId;
  }

  return null;
};
