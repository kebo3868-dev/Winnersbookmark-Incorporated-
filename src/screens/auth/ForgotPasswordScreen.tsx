import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function ForgotPasswordScreen() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function validate(): string {
    if (!email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
    return '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setEmailError(err);
      return;
    }
    setEmailError('');
    setIsLoading(true);
    // Scaffold: In production, call your backend password-reset endpoint here.
    await new Promise(resolve => setTimeout(resolve, 1200));
    setIsLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="page min-h-screen bg-ink-black flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">

        {/* Header */}
        <div className="flex items-center px-5 pt-12 pb-2">
          <button
            onClick={() => navigate('/signin')}
            className="btn-ghost px-3 py-2 text-sm"
            aria-label="Go back to sign in"
          >
            ← Back
          </button>
        </div>

        <div className="flex-1 px-6 pt-4 pb-10 flex flex-col justify-center">

          {submitted ? (
            /* Success state */
            <div className="flex flex-col items-center text-center fade-in">
              <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="section-title text-paper mb-3">Check Your Email</h2>
              <p className="text-mist text-sm leading-relaxed mb-2 max-w-xs">
                Instructions sent. If an account exists for{' '}
                <span className="text-chalk font-medium">{email}</span>, you'll receive a reset link shortly.
              </p>
              <p className="text-ghost text-xs mb-10 max-w-xs">
                Check your spam folder if you don't see it within a few minutes.
              </p>
              <Link to="/signin" className="btn-gold w-full text-center font-bold tracking-wide">
                Back to Sign In
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="mb-10">
                <p className="eyebrow mb-2">WINNERS BOOKMARK</p>
                <h1 className="section-title text-paper">Reset Password</h1>
                <p className="text-mist text-sm mt-1">
                  Enter your email and we'll send you reset instructions.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
                <div>
                  <label className="label block mb-2" htmlFor="forgot-email">Email Address</label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    placeholder="you@example.com"
                    className={`w-full glass rounded-xl px-4 py-4 text-paper placeholder-ghost text-base bg-transparent border focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all ${
                      emailError ? 'border-red-500/60' : 'border-ink-line focus:border-gold/60'
                    }`}
                  />
                  {emailError && <p className="text-red-400 text-xs mt-1.5">{emailError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-gold w-full text-base font-bold tracking-wide mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-ink-black/30 border-t-ink-black animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>

              {/* Scaffold note */}
              <div className="glass border border-ink-line rounded-xl px-4 py-3 mt-8">
                <p className="text-ghost text-xs leading-relaxed">
                  Note: This is a scaffold. Email delivery requires backend integration.
                </p>
              </div>

              <p className="text-mist text-sm text-center mt-8">
                Remember your password?{' '}
                <Link to="/signin" className="text-gold font-semibold hover:text-gold-light transition-colors">
                  Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
