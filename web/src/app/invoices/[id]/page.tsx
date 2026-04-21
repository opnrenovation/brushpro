'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle, CreditCard, FileText } from 'lucide-react';

function fmt(n: number) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface LineItem { description: string; qty: number; unit_price: number; taxable: boolean; }
interface Payment { amount: number; method: string; paid_at: string; }
interface TaxProfile { state_rate: number; local_rate: number; name: string; }
interface InvoiceData {
  id: string;
  invoice_number: string;
  type: string;
  status: string;
  due_date: string;
  line_items: LineItem[];
  payments: Payment[];
  notes?: string;
  tax_profile: TaxProfile;
  job?: { address?: string; name?: string; customer?: { name?: string; email?: string } } | null;
  customer?: { name?: string; email?: string } | null;
}
interface Settings { company_name?: string; email?: string; phone?: string; website?: string; }

const METHOD_LABEL: Record<string, string> = {
  CHECK: 'Check', CASH: 'Cash', CARD: 'Card', TRANSFER: 'Bank Transfer',
};

function InvoicePageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const justPaid = searchParams.get('paid') === 'true';

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    fetch(`/api/public/invoices/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); return; }
        setInvoice(json.data);
        setSettings(json.settings || {});
      })
      .catch(() => setError('Failed to load invoice.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handlePay() {
    setPaying(true);
    setPayError('');
    try {
      const res = await fetch(`/api/public/invoices/${id}/stripe-link`, { method: 'POST' });
      const json = await res.json();
      if (json.error) { setPayError(json.error); return; }
      window.location.href = json.data.url;
    } catch {
      setPayError('Failed to start payment. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F7' }}>
        <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 15 }}>Loading invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F7' }}>
        <div style={{ textAlign: 'center' }}>
          <FileText size={40} strokeWidth={1} style={{ color: 'rgba(0,0,0,0.2)', marginBottom: 12 }} />
          <p style={{ color: '#FF3B30', fontSize: 15 }}>{error || 'Invoice not found.'}</p>
        </div>
      </div>
    );
  }

  const lineItems = invoice.line_items || [];
  const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0);
  const taxable = lineItems.filter(li => li.taxable).reduce((s, li) => s + li.qty * li.unit_price, 0);
  const stateTax = taxable * Number(invoice.tax_profile.state_rate);
  const localTax = taxable * Number(invoice.tax_profile.local_rate);
  const total = subtotal + stateTax + localTax;
  const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = total - totalPaid;
  const isPaid = invoice.status === 'PAID' || balance <= 0;
  const recipient = invoice.job?.customer ?? invoice.customer;
  const companyName = settings.company_name || 'OPN Renovation';

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7', padding: '40px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Company header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <FileText size={24} color="#fff" strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: '0 0 2px' }}>{companyName}</p>
          {settings.phone && <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{settings.phone}</p>}
        </div>

        {/* Paid confirmation banner */}
        {(isPaid || justPaid) && (
          <div style={{ background: '#D1FAE5', border: '1px solid #34C759', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle size={22} color="#34C759" strokeWidth={1.5} />
            <div>
              <p style={{ fontWeight: 700, color: '#065F46', margin: 0 }}>Payment received — thank you!</p>
              <p style={{ fontSize: 13, color: '#059669', margin: '2px 0 0' }}>This invoice has been paid in full.</p>
            </div>
          </div>
        )}

        {/* Invoice card */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 20 }}>

          {/* Invoice header */}
          <div style={{ background: '#007AFF', padding: '24px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Invoice</p>
                <p style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>{invoice.invoice_number}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                  background: isPaid ? 'rgba(52,199,89,0.25)' : 'rgba(255,255,255,0.2)',
                  color: '#fff', fontSize: 12, fontWeight: 600,
                }}>
                  {isPaid ? 'PAID' : invoice.status}
                </span>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, margin: '8px 0 0' }}>
                  Due {new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          <div style={{ padding: '24px 28px' }}>
            {/* Recipient and job info */}
            {(recipient?.name || invoice.job?.address) && (
              <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #f0f0f0' }}>
                {recipient?.name && (
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 11, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>Billed to</p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0 }}>{recipient.name}</p>
                    {recipient.email && <p style={{ fontSize: 13, color: '#888', margin: '2px 0 0' }}>{recipient.email}</p>}
                  </div>
                )}
                {invoice.job?.address && (
                  <div>
                    <p style={{ fontSize: 11, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>Work address</p>
                    <p style={{ fontSize: 14, color: '#555', margin: 0 }}>{invoice.job.address}</p>
                  </div>
                )}
              </div>
            )}

            {/* Line items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
              <thead>
                <tr>
                  {['Description', 'Qty', 'Price', 'Total'].map((h, i) => (
                    <th key={h} style={{ fontSize: 11, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 0 10px', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '10px 0', fontSize: 14, color: '#111' }}>{li.description}</td>
                    <td style={{ padding: '10px 0', fontSize: 14, color: '#555', textAlign: 'right' }}>{li.qty}</td>
                    <td style={{ padding: '10px 0', fontSize: 14, color: '#555', textAlign: 'right' }}>{fmt(li.unit_price)}</td>
                    <td style={{ padding: '10px 0', fontSize: 14, fontWeight: 600, color: '#111', textAlign: 'right' }}>{fmt(li.qty * li.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 16, marginBottom: 20 }}>
              {[
                { label: 'Subtotal', value: subtotal },
                { label: `State Tax (${(Number(invoice.tax_profile.state_rate) * 100).toFixed(1)}%)`, value: stateTax },
                { label: `Local Tax (${(Number(invoice.tax_profile.local_rate) * 100).toFixed(1)}%)`, value: localTax },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, color: '#888' }}>{label}</span>
                  <span style={{ fontSize: 14, color: '#555' }}>{fmt(value)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '2px solid #111' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Total</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#111', fontFamily: 'Menlo, monospace' }}>{fmt(total)}</span>
              </div>
              {totalPaid > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 14, color: '#34C759' }}>Amount Paid</span>
                    <span style={{ fontSize: 14, color: '#34C759' }}>{fmt(totalPaid)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Balance Due</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: balance > 0 ? '#FF3B30' : '#34C759', fontFamily: 'Menlo, monospace' }}>{fmt(Math.max(0, balance))}</span>
                  </div>
                </>
              )}
            </div>

            {/* Payment history */}
            {invoice.payments.length > 0 && (
              <div style={{ background: '#f9f9f9', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>Payment History</p>
                {invoice.payments.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: i < invoice.payments.length - 1 ? 8 : 0 }}>
                    <span style={{ fontSize: 13, color: '#555' }}>
                      {METHOD_LABEL[p.method] || p.method} · {new Date(p.paid_at).toLocaleDateString()}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#34C759' }}>{fmt(Number(p.amount))}</span>
                  </div>
                ))}
              </div>
            )}

            {invoice.notes && (
              <p style={{ fontSize: 13, color: '#888', borderTop: '1px solid #f0f0f0', paddingTop: 16, margin: '0 0 20px' }}>{invoice.notes}</p>
            )}
          </div>
        </div>

        {/* Pay button */}
        {!isPaid && balance > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '24px 28px' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: '0 0 4px' }}>Pay online</p>
            <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>Secure payment powered by Stripe. Credit and debit cards accepted.</p>
            {payError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 12 }}>{payError}</p>}
            <button
              onClick={handlePay}
              disabled={paying}
              style={{
                width: '100%', padding: '14px', background: paying ? '#aaa' : '#007AFF', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: paying ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <CreditCard size={18} strokeWidth={1.5} />
              {paying ? 'Redirecting...' : `Pay ${fmt(balance)} Now`}
            </button>
            <p style={{ fontSize: 12, color: '#bbb', textAlign: 'center', marginTop: 12 }}>
              You will be redirected to Stripe to complete your payment securely.
            </p>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 12, color: '#bbb', marginTop: 24 }}>
          {companyName}{settings.phone ? ` · ${settings.phone}` : ''}{settings.email ? ` · ${settings.email}` : ''}
        </p>
      </div>
    </div>
  );
}

export default function InvoicePage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F5F5F7' }} />}><InvoicePageInner /></Suspense>;
}
