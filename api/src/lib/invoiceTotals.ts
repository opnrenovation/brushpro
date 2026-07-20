// Single source of truth for invoice money math.
// Every place that needs an invoice's subtotal / discount / tax / total / balance
// MUST use this so the number is computed identically in the PDF, the emailed
// invoice, the Stripe charge, payment-status logic, and the tax reports.

export interface TotalsLineItem {
  qty: number;
  unit_price: number;
  taxable?: boolean;
}

export interface TotalsInput {
  line_items: TotalsLineItem[];
  discount_type?: string | null;
  discount_value?: number | string | null;
  state_rate?: number | string | null;
  local_rate?: number | string | null;
  amount_paid?: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  discountedSubtotal: number;
  taxableAmount: number;
  stateTax: number;
  localTax: number;
  tax: number;
  total: number;
  amountPaid: number;
  balance: number;
}

export function calcDiscount(
  subtotal: number,
  type: string | null | undefined,
  value: number | string | null | undefined,
): number {
  if (!type || type === 'NONE' || value == null || value === '') return 0;
  const v = Number(value);
  if (!isFinite(v) || v <= 0) return 0;
  if (type === 'PERCENT') return subtotal * (v / 100);
  if (type === 'FIXED') return Math.min(v, subtotal);
  return 0;
}

export function computeInvoiceTotals(input: TotalsInput): InvoiceTotals {
  const items = input.line_items || [];
  const subtotal = items.reduce((s, li) => s + Number(li.qty) * Number(li.unit_price), 0);
  const discountAmount = calcDiscount(subtotal, input.discount_type, input.discount_value);
  const discountedSubtotal = subtotal - discountAmount;

  const taxableRaw = items
    .filter((li) => li.taxable !== false)
    .reduce((s, li) => s + Number(li.qty) * Number(li.unit_price), 0);
  const taxableFraction = subtotal > 0 ? taxableRaw / subtotal : 1;
  const taxableAmount = discountedSubtotal * taxableFraction;

  const stateRate = Number(input.state_rate ?? 0);
  const localRate = Number(input.local_rate ?? 0);
  const stateTax = taxableAmount * stateRate;
  const localTax = taxableAmount * localRate;
  const tax = stateTax + localTax;
  const total = discountedSubtotal + tax;

  const amountPaid = Number(input.amount_paid ?? 0);
  const balance = total - amountPaid;

  return {
    subtotal,
    discountAmount,
    discountedSubtotal,
    taxableAmount,
    stateTax,
    localTax,
    tax,
    total,
    amountPaid,
    balance,
  };
}
