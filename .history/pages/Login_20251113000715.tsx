import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const success = await login(username, password);
      if (!success) {
        setError('Geçersiz kullanıcı adı veya şifre.');
      }
    } catch (err) {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-brand-dark">
      <div className="bg-brand-card p-8 rounded-lg border border-brand-border shadow-lg w-full max-w-sm">
        <div className="flex items-center justify-center mb-6">
            <div className="bg-brand-primary h-12 w-12 rounded-lg mr-4"></div>
            <h1 className="text-2xl font-bold text-white">PM Logbook</h1>
        </div>
        <p className="text-center text-brand-light text-sm mb-4">Veritabanındaki bir kullanıcı ile giriş yapın. <br /> Örn: admin / adminpass</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-brand-light">Kullanıcı Adı</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full bg-brand-dark border border-brand-border rounded-md shadow-sm p-2 text-white focus:ring-brand-primary focus:border-brand-primary"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-brand-light">Şifre</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full bg-brand-dark border border-brand-border rounded-md shadow-sm p-2 text-white focus:ring-brand-primary focus:border-brand-primary"
              required
            />
          </div>
           {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-brand-secondary disabled:cursor-not-allowed"
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
