/** ADR 008: DB uses `received`; FE/OpenAPI still say `paid`. Map only at HTTP boundary. */
export type DbDepositStatus =
  | 'not_required'
  | 'pending'
  | 'received'
  | 'forfeited'
  | 'refunded'
  | 'voided';

export type ApiDepositStatus =
  | 'not_required'
  | 'pending'
  | 'paid'
  | 'applied'
  | 'forfeited'
  | 'refunded'
  | 'voided';

export function toApiDepositStatus(status: DbDepositStatus | string): ApiDepositStatus {
  if (status === 'received') return 'paid';
  return status as ApiDepositStatus;
}

export function depositWasReceived(status: DbDepositStatus | string): boolean {
  return status === 'received' || status === 'paid' || status === 'applied' || status === 'forfeited';
}
