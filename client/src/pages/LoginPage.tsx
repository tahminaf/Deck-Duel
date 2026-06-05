import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { setSession } from '../lib/session';

type Mode = 'login' | 'signup';
type Step = 'form' | 'verify' | 'mfa' | 'forgot' | 'resetPassword';

const pwdChecks = (pwd: string) => ({
  length: pwd.length >= 8,
  upper: /[A-Z]/.test(pwd),
  lower: /[a-z]/.test(pwd),
  number: /[0-9]/.test(pwd),
});

const isStrong = (pwd: string) => Object.values(pwdChecks(pwd)).every(Boolean);

function PasswordStrength({ password }: { password: string }) {
  const checks = pwdChecks(password);
  const items = [
    { ok: checks.length, label: 'At least 8 characters' },
    { ok: checks.upper,  label: 'One uppercase letter' },
    { ok: checks.lower,  label: 'One lowercase letter' },
    { ok: checks.number, label: 'One number' },
  ];
  return (
    <div className="mb-2 space-y-1">
      {items.map(({ ok, label }) => (
        <div key={label} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-sage-400' : 'text-red-400'}`}>
          <span>{ok ? '✓' : '○'}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('form');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [session, setSession] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(''); setSuccess('');
    setPassword(''); setConfirmPassword('');
  };

  const handleSubmit = async () => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      if (mode === 'signup') {
        await authApi.signup(email, password, username);
        setStep('verify');
      } else {
        const res = await authApi.login(email, password);
        if (res.data.challenge === 'MFA_REQUIRED') {
          if (res.data.resolvedEmail) setEmail(res.data.resolvedEmail);
          setSession(res.data.session);
          setStep('mfa');
        } else {
          setSession(res.data.tokens.accessToken, res.data.preferredUsername || email.split('@')[0]);
          navigate('/home', { replace: true });
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError(''); setLoading(true);
    try {
      await authApi.confirmSignup(email, verifyCode);
      setStep('form'); setMode('login'); setVerifyCode('');
      setSuccess('Email verified! You can now sign in.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError(''); setSuccess(''); setResending(true);
    try {
      await authApi.resendVerification(email);
      setSuccess('Code resent — check your email.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not resend code.');
    } finally {
      setResending(false);
    }
  };

  const handleMfa = async () => {
    setError(''); setLoading(true);
    try {
      const res = await authApi.verifyMfa(email, password, mfaCode, session);
      setSession(res.data.tokens.accessToken, res.data.preferredUsername || email.split('@')[0]);
      navigate('/home', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(''); setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      if (res.data.resolvedEmail) setEmail(res.data.resolvedEmail);
      setStep('resetPassword');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    setError(''); setSuccess(''); setResending(true);
    try {
      await authApi.forgotPassword(email);
      setSuccess('Code resent — check your email.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not resend code.');
    } finally {
      setResending(false);
    }
  };

  const handleResetPassword = async () => {
    setError(''); setLoading(true);
    try {
      await authApi.confirmForgotPassword(email, resetCode, newPassword);
      setStep('form'); setMode('login');
      setResetCode(''); setNewPassword(''); setConfirmNewPassword('');
      setSuccess('Password reset! You can now sign in.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code or password.');
    } finally {
      setLoading(false);
    }
  };

  const ErrorBox = ({ msg }: { msg: string }) => (
    <div className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-lg px-4 py-3 mb-4">{msg}</div>
  );

  const SuccessBox = ({ msg }: { msg: string }) => (
    <div className="bg-sage-50 border border-sage-100 text-sage-400 text-sm rounded-lg px-4 py-3 mb-4">{msg}</div>
  );

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage-400";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-gray-100 px-6 py-4">
        <span className="font-serif text-xl tracking-tight">
          Deck<span className="text-sage-400">Duel</span>
        </span>
      </nav>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">

          {/* ── VERIFY EMAIL ── */}
          {step === 'verify' && (
            <>
              <h1 className="font-serif text-3xl font-medium text-gray-900 mb-1">Check your email.</h1>
              <p className="text-sm text-gray-400 mb-8">We sent a verification code to <strong>{email}</strong></p>

              {error && <ErrorBox msg={error} />}
              {success && <SuccessBox msg={success} />}

              <div className="mb-6">
                <label className="text-xs text-gray-400 block mb-1">Verification code</label>
                <input
                  className={`${inputCls} font-serif text-center text-2xl tracking-widest`}
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <button onClick={handleVerify} disabled={loading}
                className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50">
                {loading ? 'Verifying…' : 'Verify email →'}
              </button>
              <div className="flex justify-between mt-3">
                <button onClick={() => { setStep('form'); setError(''); setSuccess(''); }}
                  className="text-sm text-gray-400 hover:text-sage-400 transition-colors">
                  ← Back
                </button>
                <button onClick={handleResendVerification} disabled={resending}
                  className="text-sm text-gray-400 hover:text-sage-400 transition-colors disabled:opacity-50">
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              </div>
            </>
          )}

          {/* ── MFA ── */}
          {step === 'mfa' && (
            <>
              <h1 className="font-serif text-3xl font-medium text-gray-900 mb-1">Two-factor auth.</h1>
              <p className="text-sm text-gray-400 mb-8">Enter the code from your authenticator app</p>

              {error && <ErrorBox msg={error} />}

              <div className="mb-6">
                <label className="text-xs text-gray-400 block mb-1">6-digit code</label>
                <input
                  className={`${inputCls} font-serif text-center text-2xl tracking-widest`}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <button onClick={handleMfa} disabled={loading}
                className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50">
                {loading ? 'Verifying…' : 'Verify →'}
              </button>
            </>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {step === 'forgot' && (
            <>
              <h1 className="font-serif text-3xl font-medium text-gray-900 mb-1">Forgot password.</h1>
              <p className="text-sm text-gray-400 mb-8">Enter your email or username and we'll send a reset code</p>

              {error && <ErrorBox msg={error} />}

              <div className="mb-6">
                <label className="text-xs text-gray-400 block mb-1">Email or username</label>
                <input className={inputCls} value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com or tahmina" autoComplete="email" />
              </div>

              <button onClick={handleForgotPassword} disabled={loading}
                className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50">
                {loading ? 'Sending…' : 'Send reset code →'}
              </button>
              <button onClick={() => { setStep('form'); setError(''); }}
                className="w-full mt-3 text-sm text-gray-400 hover:text-sage-400 transition-colors">
                ← Back to sign in
              </button>
            </>
          )}

          {/* ── RESET PASSWORD ── */}
          {step === 'resetPassword' && (
            <>
              <h1 className="font-serif text-3xl font-medium text-gray-900 mb-1">Reset password.</h1>
              <p className="text-sm text-gray-400 mb-8">Enter the code sent to <strong>{email}</strong></p>

              {error && <ErrorBox msg={error} />}
              {success && <SuccessBox msg={success} />}

              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-1">Reset code</label>
                <input
                  className={`${inputCls} font-serif text-center text-2xl tracking-widest`}
                  value={resetCode} onChange={e => setResetCode(e.target.value)}
                  placeholder="000000" maxLength={6}
                />
              </div>

              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-1">New password</label>
                <PasswordStrength password={newPassword} />
                <input className={inputCls} type="password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="new-password" />
              </div>

              <div className="mb-6">
                <label className="text-xs text-gray-400 block mb-1">Confirm new password</label>
                <input className={inputCls} type="password" value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="new-password" />
                {confirmNewPassword && newPassword !== confirmNewPassword && (
                  <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                )}
              </div>

              <button
                onClick={handleResetPassword}
                disabled={loading || !isStrong(newPassword) || newPassword !== confirmNewPassword}
                className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50">
                {loading ? 'Resetting…' : 'Set new password →'}
              </button>
              <div className="flex justify-between mt-3">
                <button onClick={() => { setStep('forgot'); setError(''); setSuccess(''); }}
                  className="text-sm text-gray-400 hover:text-sage-400 transition-colors">
                  ← Back
                </button>
                <button onClick={handleResendResetCode} disabled={resending}
                  className="text-sm text-gray-400 hover:text-sage-400 transition-colors disabled:opacity-50">
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              </div>
            </>
          )}

          {/* ── MAIN FORM ── */}
          {step === 'form' && (
            <>
              <h1 className="font-serif text-3xl font-medium text-gray-900 mb-1">
                {mode === 'login' ? 'Welcome back.' : 'Create account.'}
              </h1>
              <p className="text-sm text-gray-400 mb-8">
                {mode === 'login' ? 'Sign in to challenge a friend' : 'Join and start dueling'}
              </p>

              {error && <ErrorBox msg={error} />}
              {success && <SuccessBox msg={success} />}

              {mode === 'signup' && (
                <div className="mb-4">
                  <label className="text-xs text-gray-400 block mb-1">Username</label>
                  <input className={inputCls} value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="tahmina" autoComplete="username" />
                </div>
              )}

              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-1">
                  {mode === 'login' ? 'Email or username' : 'Email'}
                </label>
                <input
                  className={inputCls}
                  type={mode === 'signup' ? 'email' : 'text'}
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={mode === 'login' ? 'you@example.com or tahmina' : 'you@example.com'}
                  autoComplete="email"
                />
              </div>

              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-1">Password</label>
                {mode === 'signup' && <PasswordStrength password={password} />}
                <input
                  className={inputCls}
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleSubmit()}
                />
              </div>

              {mode === 'signup' && (
                <div className="mb-6">
                  <label className="text-xs text-gray-400 block mb-1">Confirm password</label>
                  <input className={inputCls} type="password" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="new-password" />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                  )}
                </div>
              )}

              {mode === 'login' && (
                <div className="mb-6 text-right">
                  <button onClick={() => { setStep('forgot'); setError(''); setSuccess(''); }}
                    className="text-xs text-gray-400 hover:text-sage-400 transition-colors">
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || (mode === 'signup' && (!isStrong(password) || password !== confirmPassword))}
                className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50">
                {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>

              <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                className="w-full mt-3 text-sm text-gray-400 hover:text-sage-400 transition-colors">
                {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
