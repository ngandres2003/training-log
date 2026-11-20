import type { Id } from '@training-log/domain'

/**
 * HOOK POINT for U14 (V7 · Finalizar entreno). V5's FINALIZAR (after the unchecked-sets warning)
 * and V6's FINALIZAR ENTRENO call this with the active workout id.
 *
 * TODO(U14): open V7 for `workoutId`. Until then it does nothing and closes nothing: the
 * workout stays active and V5 stays open.
 */
export function onFinishRequested(workoutId: Id): void {
  void workoutId
}
