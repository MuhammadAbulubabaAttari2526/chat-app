import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Chat from './pages/Chat.jsx';

function Protected({ children }) {
  const { user, token, loading } = useAuth();
  if (loading) return <div className="splash">Loading…</div>;
  if (!token || !user) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { token, user, loading } = useAuth();
  if (loading) return <div className="splash">Loading…</div>;
  if (token && user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/" element={<Protected><Chat /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
