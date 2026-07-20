// Single source of truth for invoice money math on the client.
// Mirrors api/src/lib/invoiceTotals.ts. Any UI that shows an invoice total,
// outstanding balance, or pre-fills a payment amount MUST use this so the
// numbers match the PDF / email / Stripe charge exactly.

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

export function computeInvoiceTotals(input: TotalsInput) {
  const items = input.line_items || [];
  const subtotal = items.reduce((s, li) => s + Number(li.qty || 0) * Number(li.unit_price || 0), 0);
  const discountAmount = calcDiscount(subtotal, input.discount_type, input.discount_value);
  const discountedSubtotal = subtotal - discountAmount;

  const taxableRaw = items
    .filter((li) => li.taxable !== false)
    .reduce((s, li) => s + Number(li.qty || 0) * Number(li.unit_price || 0), 0);
  const taxableFraction = subtotal > 0 ? taxableRaw / subtotal : 1;
  const taxableAmount = discountedSubtotal * taxableFraction;

  const stateTax = taxableAmount * Number(input.state_rate ?? 0);
  const localTax = taxableAmount * Number(input.local_rate ?? 0);
  const tax = stateTax + localTax;
  const total = discountedSubtotal + tax;

  const amountPaid = Number(input.amount_paid ?? 0);
  const balance = total - amountPaid;

  return { subtotal, discountAmount, discountedSubtotal, taxableAmount, stateTax, localTax, tax, total, amountPaid, balance };
}
