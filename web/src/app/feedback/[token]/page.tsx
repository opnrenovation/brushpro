'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Star, CheckCircle, ExternalLink } from 'lucide-react';

interface FeedbackContext {
  company_name: string;
  customer_name: string | null;
  completed: boolean;
  google_review_url: string | null;
}

export default function FeedbackPage() {
  const { token } = useParams<{ token: string }>();

  const [context, setContext] = useState<FeedbackContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/feedback/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); return; }
        setContext(json.data);
        if (json.data.completed) {
          setDone(true);
          setReviewUrl(json.data.google_review_url);
        }
      })
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit() {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/feedback/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comments }),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      setReviewUrl(json.data.google_review_url);
      setDone(true);
    } catch {
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const card: React.CSSProperties = {
    maxWidth: 520,
    margin: '0 auto',
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e5e7eb',
    boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
    padding: '40px 32px',
  };

  return (
    <main style={{ minHeight: '100vh', background: '#F5F5F7', padding: '64px 16px' }}>
      {loading ? (
        <div style={{ ...card, textAlign: 'center', color: '#666' }}>Loading...</div>
      ) : error && !context ? (
        <div style={{ ...card, textAlign: 'center', color: '#666' }}>
          This feedback link is no longer available.
        </div>
      ) : done ? (
        <div style={{ ...card, textAlign: 'center' }}>
          <CheckCircle size={44} strokeWidth={1.5} style={{ color: '#16a34a', marginBottom: 16 }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1D1D1F', marginBottom: 12 }}>
            Thank you for your feedback
          </h1>
          <p style={{ color: '#555', fontSize: 15, lineHeight: 1.7, marginBottom: reviewUrl ? 28 : 0 }}>
            It means a lot to our family business.
          </p>
          {reviewUrl && (
            <>
              <p style={{ color: '#555', fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
                If you have one more minute, a Google review helps neighbors like you find us.
              </p>
              <a
                href={reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#007AFF',
                  color: '#fff',
                  padding: '14px 28px',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                Leave a Google Review
                <ExternalLink size={16} strokeWidth={1.5} />
              </a>
            </>
          )}
        </div>
      ) : (
        <div style={card}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1D1D1F', marginBottom: 8 }}>
            How did we do{context?.customer_name ? `, ${context.customer_name.split(' ')[0]}` : ''}?
          </h1>
          <p style={{ color: '#555', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
            Thank you for choosing {context?.company_name}. Your honest feedback helps our small
            crew keep improving.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <Star
                  size={34}
                  strokeWidth={1.5}
                  style={{
                    color: (hovered || rating) >= n ? '#E8A838' : '#D1D5DB',
                    fill: (hovered || rating) >= n ? '#E8A838' : 'none',
                    transition: 'color 120ms',
                  }}
                />
              </button>
            ))}
          </div>

          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Tell us about your experience (optional)"
            rows={4}
            style={{
              width: '100%',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 15,
              fontFamily: 'inherit',
              color: '#1D1D1F',
              resize: 'vertical',
              marginBottom: 20,
            }}
          />

          {error && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 16 }}>{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={rating < 1 || submitting}
            style={{
              width: '100%',
              background: rating < 1 ? '#9CA3AF' : '#007AFF',
              color: '#fff',
              border: 'none',
              padding: '14px 0',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 16,
              cursor: rating < 1 ? 'default' : 'pointer',
            }}
          >
            {submitting ? 'Sending...' : 'Send Feedback'}
          </button>
        </div>
      )}
    </main>
  );
}
