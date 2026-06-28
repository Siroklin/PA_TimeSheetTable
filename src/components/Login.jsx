import { useState } from 'react';
import { login, setToken } from '../api';
import proAquaLogo from '../assets/proaqua-logo.svg';

export default function Login({ onLogin }) {
  const [stage, setStage]       = useState('splash');
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!loginName.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await login(loginName.trim(), password);
      setToken(resp.token);
      onLogin(resp.user);
    } catch (e) {
      setError(e.message || 'Неверный логин или пароль.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-center">
        <img src={proAquaLogo} alt="PRO AQUA" className="login-logo" />
        <h1 className="login-title">График работы</h1>

        {stage === 'splash' && (
          <button className="btn-save login-enter-btn" onClick={() => setStage('form')}>
            Войти
          </button>
        )}

        {stage === 'form' && (
          <form className="login-form" onSubmit={handleSubmit}>
            <input
              className="form-input"
              placeholder="Логин"
              value={loginName}
              onChange={e => setLoginName(e.target.value)}
              autoFocus
            />
            <input
              className="form-input"
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {error && <div className="upload-error-line">{error}</div>}
            <button className="btn-save" type="submit" disabled={loading || !loginName.trim() || !password}>
              {loading ? '...' : 'Войти'}
            </button>
          </form>
        )}
      </div>

      <div className="login-version">v1.0</div>
    </div>
  );
}
