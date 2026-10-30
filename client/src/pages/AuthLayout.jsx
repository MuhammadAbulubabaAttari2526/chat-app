import Ticks from '../components/Ticks.jsx';

// Shared shell for login/register. The left panel doubles as a legend
// for the delivery states used in the chat.
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <aside className="auth-art" aria-hidden="true">
        <h1 className="brand">Relay</h1>
        <p className="auth-tag">One-to-one messages that arrive the moment you send them.</p>
        <div className="legend">
          <div className="bubble-row mine"><div className="bubble"><span className="bubble-text">Are you free at 3?</span><span className="bubble-meta"><time>2:58 PM</time><Ticks status="sent" /></span></div></div>
          <div className="bubble-row mine"><div className="bubble"><span className="bubble-text">Booked the room.</span><span className="bubble-meta"><time>2:59 PM</time><Ticks status="delivered" /></span></div></div>
          <div className="bubble-row mine"><div className="bubble"><span className="bubble-text">See you there.</span><span className="bubble-meta"><time>3:00 PM</time><Ticks status="read" /></span></div></div>
          <p className="legend-note">Sent, delivered, read.</p>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <h2>{title}</h2>
          <p className="auth-sub">{subtitle}</p>
          {children}
          <p className="auth-foot">{footer}</p>
        </div>
      </main>
    </div>
  );
}
