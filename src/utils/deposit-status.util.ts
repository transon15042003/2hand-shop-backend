/** ADR 008: canonical deposit_status matches DB / OpenAPI. */
export type DepositStatus =
  | 'not_required'
  | 'pending'
  | 'received'
  | 'forfeited'
  | 'refunded'
  | 'voided';

export function depositWasReceived(status: DepositStatus | string): boolean {
  return status === 'received' || status === 'forfeited';
}
