interface DepositSettings {
  deposit_required: boolean;
  deposit_percentage: unknown;
  deposit_minimum_amount: unknown;
  deposit_min_job_total: unknown;
}

export interface DepositResult {
  required: boolean;
  amount: number;
  percentage: number;
}

// Deposit policy: deposit_percentage of the subtotal (at least
// deposit_minimum_amount), but jobs whose total is under
// deposit_min_job_total require no deposit at all.
export function computeDeposit(
  settings: DepositSettings | null,
  subtotal: number,
  total: number,
): DepositResult {
  const percentage = Number(settings?.deposit_percentage ?? 50);
  if (!settings?.deposit_required) return { required: false, amount: 0, percentage };

  const threshold = Number(settings?.deposit_min_job_total ?? 0);
  if (threshold > 0 && total < threshold) return { required: false, amount: 0, percentage };

  const amount = Math.max((subtotal * percentage) / 100, Number(settings?.deposit_minimum_amount ?? 0));
  return { required: amount > 0, amount, percentage };
}

// Sentence used in contracts ({deposit_terms}), estimate emails, and PDFs.
export function depositTerms(deposit: DepositResult, total: number): string {
  return deposit.required
    ? `A deposit of ${deposit.percentage}% ($${deposit.amount.toFixed(2)}) is due upon signing this agreement. The remaining balance of $${(total - deposit.amount).toFixed(2)} is due upon completion of the project and final walkthrough.`
    : `No deposit is required for this project. Work will be scheduled upon approval, and the full balance of $${total.toFixed(2)} is due upon completion of the project and final walkthrough.`;
}
