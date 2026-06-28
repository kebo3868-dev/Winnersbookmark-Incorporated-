import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface FormState {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function SignInScreen() {
  const navigate = useNavigate();
  const { signIn, onboardingComplete } = useAuth();

  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!form.email.trim()) {
      e.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Enter a valid email address.';
    }
    if (!form.password) {
      e.password = 'Password is required.';
    }
    return e;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      await signIn(form.email, form.password);
      // After signIn, check onboardingComplete from the context
      // The value may not yet have updated in this closure, so we
      // read it after the await — AuthContext sets onboardingComplete
      // synchronously before the promise resolves in this scaffold.
      // Navigate based on storage directly for reliability:
      const isOnboarded = localStorage.getItem('wbf_onboarding_complete') === 'true';
      navigate(isOnboarded ? '/' : '/onboarding', { replace: true });
    } catch {
      setErrors({ general: 'Invalid credentials. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }

  function handleChange(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }

  // Suppress unused variable warning — onboardingComplete available if needed for other logic
  void onboardingComplete;

  return (
    <div className="page min-h-screen bg-ink-black flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">

        {/* Header */}
        <div className="flex items-center px-5 pt-12 pb-2">
          <button
            onClick={() => navigate('/welcome')}
            className="btn-ghost px-3 py-2 text-sm mr-3"
            aria-label="Go back"
          >
            ← Back
          </button>
        </div>

        {/* Form area */}
        <div className="flex-1 px-6 pt-4 pb-10 overflow-y-auto flex flex-col justify-center">

          {/* Eyebrow + heading */}
          <div className="mb-10">
            <p className="eyebrow mb-2">WINNERS BOOKMARK</p>
            <h1 className="section-title text-paper">Welcome Back</h1>
            <p className="text-mist text-sm mt-1">Sign in and pick up where you left off.</p>
          </div>

          {errors.general && (
            <div className="glass border border-red-500/30 rounded-xl px-4 py-3 mb-6">
              <p className="text-red-400 text-sm">{errors.general}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>

            {/* Email */}
            <div>
              <label className="label block mb-2" htmlFor="signin-email">Email Address</label>
              <input
                id="signin-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                placeholder="you@example.com"
                className={`w-full glass rounded-xl px-4 py-4 text-paper placeholder-ghost text-base bg-transparent border focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all ${
                  errors.email ? 'border-red-500/60' : 'border-ink-line focus:border-gold/60'
                }`}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label" htmlFor="signin-password">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-gold text-xs font-medium hover:text-gold-light transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={e => handleChange('password', e.target.value)}
                  placeholder="Your password"
                  className={`w-full glass rounded-xl px-4 py-4 pr-12 text-paper placeholder-ghost text-base bg-transparent border focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all ${
                    errors.password ? 'border-red-500/60' : 'border-ink-line focus:border-gold/60'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ghost hover:text-chalk transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-gold w-full text-base font-bold tracking-wide mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-ink-black/30 border-t-ink-black animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Sign up link */}
          <p className="text-mist text-sm text-center mt-8">
            New here?{' '}
            <Link to="/signup" className="text-gold font-semibold hover:text-gold-light transition-colors">
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
