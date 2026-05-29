import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import axios from 'axios';

const API_URL = 'https://0jq69kep40.execute-api.us-east-1.amazonaws.com/Prod';

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [session, setSession] = useState('');
  const [step, setStep] = useState<'form' | 'verify' | 'mfa'>('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await authApi.signup(email, password, username);
        setStep('verify');
      } else {
        const res = await authApi.login(email, password);
        if (res.data.challenge === 'MFA_REQUIRED') {
          setSession(res.data.session);
          setStep('mfa');
        } else {
          localStorage.setItem('accessToken', res.data.tokens.accessToken);
          localStorage.setItem('username', username || email.split('@')[0]);
          navigate('/home');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth`, {
        action: 'confirmSignup',
        email,
        code: verifyCode,
      });
      setStep('form');
      setMode('login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.verifyMfa(email, password, mfaCode, session);
      localStorage.setItem('accessToken', res.data.tokens.accessToken);
      localStorage.setItem('username', email.split('@')[0]);
      navigate('/home');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-gray-100 px-6 py-4">
        <span className="font-serif text-xl tracking-tight">
          Deck<span className="text-sage-400">Duel</span>
        </span>
      </nav>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">

          {/* VERIFY EMAIL STEP */}
          {step === 'verify' && (
            <>
              <h1 className="font-serif text-3xl font-medium text-gray-900 mb-1">
                Check your email.
              </h1>
              <p className="text-sm text-gray-400 mb-8">
                We sent a verification code to <strong>{email}</strong>
              </p>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-lg px-4 py-3 mb-4">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <label className="text-xs text-gray-400 block mb-1">Verification code</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage-400 font-serif text-center text-2xl tracking-widest"
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <button
                onClick={handleVerify}
                disabled={loading}
                className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify email →'}
              </button>

              <button
                onClick={() => setStep('form')}
                className="w-full mt-3 text-sm text-gray-400 hover:text-sage-400 transition-colors"
              >
                ← Back
              </button>
            </>
          )}

          {/* MFA STEP */}
          {step === 'mfa' && (
            <>
              <h1 className="font-serif text-3xl font-medium text-gray-900 mb-1">
                Two-factor auth.
              </h1>
              <p className="text-sm text-gray-400 mb-8">
                Enter the code from your authenticator app
              </p>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-lg px-4 py-3 mb-4">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <label className="text-xs text-gray-400 block mb-1">6-digit code</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage-400 font-serif text-center text-2xl tracking-widest"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <button
                onClick={handleMfa}
                disabled={loading}
                className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify →'}
              </button>
            </>
          )}

          {/* MAIN FORM */}
          {step === 'form' && (
            <>
              <h1 className="font-serif text-3xl font-medium text-gray-900 mb-1">
                {mode === 'login' ? 'Welcome back.' : 'Create account.'}
              </h1>
              <p className="text-sm text-gray-400 mb-8">
                {mode === 'login' ? 'Sign in to challenge a friend' : 'Join and start dueling'}
              </p>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-lg px-4 py-3 mb-4">
                  {error}
                </div>
              )}

              {mode === 'signup' && (
                <div className="mb-4">
                  <label className="text-xs text-gray-400 block mb-1">Username</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage-400"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="tahmina"
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-1">Email</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage-400"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="mb-6">
                <label className="text-xs text-gray-400 block mb-1">Password</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage-400"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>

              <button
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                className="w-full mt-3 text-sm text-gray-400 hover:text-sage-400 transition-colors"
              >
                {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}