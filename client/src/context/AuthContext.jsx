import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  // Validate a stored token on first load
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api('/api/auth/me')
      .then((d) => !cancelled && setUser(d.user))
      .catch(() => !cancelled && logout())
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const authenticate = useCallback((data) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setToken(data.token);
  }, []);

  const login = async (email, password) =>
    authenticate(await api('/api/auth/login', { method: 'POST', body: { email, password } }));

  const register = async (username, email, password) =>
    authenticate(
      await api('/api/auth/register', { method: 'POST', body: { username, email, password } })
    );

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
