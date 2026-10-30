// Delivery state shown on your own messages:
// sending (clock) · sent ✓ · delivered ✓✓ · read ✓✓ (blue)
export default function Ticks({ status }) {
  if (status === 'sending')
    return (
      <svg className="tick tick-pending" viewBox="0 0 16 16" aria-label="Sending">
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3.2l2 1.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  if (status === 'failed')
    return (
      <svg className="tick tick-failed" viewBox="0 0 16 16" aria-label="Not sent">
        <circle cx="8" cy="8" r="6" fill="currentColor" />
        <path d="M8 4.5v4M8 10.8v.1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );

  const double = status === 'delivered' || status === 'read';
  return (
    <svg
      className={`tick ${status === 'read' ? 'tick-read' : ''}`}
      viewBox="0 0 20 16"
      aria-label={status === 'read' ? 'Read' : status === 'delivered' ? 'Delivered' : 'Sent'}
    >
      <path d="M2 8.5l3.5 3.5L12 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {double && (
        <path d="M8.5 11.5l.9.9L17 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
