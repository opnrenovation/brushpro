'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, Plus, CheckCircle, XCircle, Upload } from 'lucide-react';
import { contactsApi } from '@/lib/api';

const TYPES = ['ALL', 'PROSPECT', 'CUSTOMER', 'BOTH'];

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  type: string;
  tags: string[];
  subscribed: boolean;
  source: string | null;
  created_at: string;
}

export default function ContactsPage() {
  const [tab, setTab] = useState<'contacts' | 'lists' | 'import'>('contacts');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const { data } = useQuery({ queryKey: ['contacts'], queryFn: () => contactsApi.list() });
  const contacts: Contact[] = data?.data?.data || data?.data || [];

  const filtered = contacts.filter((c) => {
    const matchType = typeFilter === 'ALL' || c.type === typeFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const subscribed = contacts.filter((c) => c.subscribed).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Users size={20} color="#007AFF" strokeWidth={1.5} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Contacts</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            {contacts.length} total &middot; {subscribed} subscribed
          </p>
        </div>
        <button className="btn btn-primary">
          <Plus size={16} strokeWidth={1.5} /> New Contact
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {(['contacts', 'lists', 'import'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              color: tab === t ? '#007AFF' : 'rgba(255,255,255,0.5)',
              borderBottom: `2px solid ${tab === t ? '#007AFF' : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ALL CONTACTS TAB */}
      {tab === 'contacts' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
              <Search
                size={15}
                strokeWidth={1.5}
                color="rgba(255,255,255,0.3)"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="glass-input"
                style={{ width: '100%', padding: '9px 12px 9px 36px', fontSize: 14 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: typeFilter === t ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.05)',
                    color: typeFilter === t ? '#007AFF' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="glass" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Type</th><th>Tags</th><th>Subscribed</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 40 }}>
                      No contacts found
                    </td>
                  </tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500, color: '#fff' }}>
                      {c.first_name} {c.last_name}
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{c.email}</td>
                    <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{c.phone || '—'}</td>
                    <td>
                      <span className="pill pill-blue" style={{ fontSize: 10 }}>{c.type}</span>
                    </td>
                    <td>
                      {c.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            background: 'rgba(255,255,255,0.08)',
                            borderRadius: 6,
                            padding: '2px 7px',
                            color: 'rgba(255,255,255,0.5)',
                            marginRight: 4,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </td>
                    <td>
                      {c.subscribed ? (
                        <CheckCircle size={15} color="#34C759" strokeWidth={1.5} />
                      ) : (
                        <XCircle size={15} color="rgba(255,255,255,0.2)" strokeWidth={1.5} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* LISTS TAB */}
      {tab === 'lists' && (
        <div className="glass" style={{ padding: 40, textAlign: 'center' }}>
          <Users size={36} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: 16 }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Contact lists appear here.</p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Create lists to segment your contacts for targeted email campaigns.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 20 }}>
            <Plus size={15} strokeWidth={1.5} /> Create List
          </button>
        </div>
      )}

      {/* IMPORT TAB */}
      {tab === 'import' && (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
            style={{
              border: `2px dashed ${dragOver ? '#007AFF' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 16,
              padding: '64px 40px',
              textAlign: 'center',
              background: dragOver ? 'rgba(0,122,255,0.05)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
              marginBottom: 24,
            }}
          >
            <Upload size={40} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: 16 }} />
            <p style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              Drop a CSV file here
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24 }}>
              or click to browse. Required columns: first_name, last_name, email
            </p>
            <label style={{ cursor: 'pointer' }}>
              <div className="btn btn-ghost" style={{ display: 'inline-flex' }}>
                <Upload size={15} strokeWidth={1.5} />
                Choose CSV File
              </div>
              <input type="file" accept=".csv" style={{ display: 'none' }} />
            </label>
          </div>

          <div className="glass" style={{ padding: '20px 24px' }}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>CSV Format Guide</h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.7 }}>
              The CSV file should have a header row with these columns (in any order):
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {['first_name *', 'last_name *', 'email *', 'phone', 'tags', 'source'].map((col) => (
                <span
                  key={col}
                  style={{
                    fontSize: 12,
                    background: col.includes('*') ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.07)',
                    border: col.includes('*') ? '1px solid rgba(0,122,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                    color: col.includes('*') ? '#007AFF' : 'rgba(255,255,255,0.5)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontFamily: 'Menlo, monospace',
                  }}
                >
                  {col}
                </span>
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 10 }}>
              * Required fields
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
