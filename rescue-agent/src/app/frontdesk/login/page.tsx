import { LoginForm } from './LoginForm';

/** Public entry only. The existing API verifies credentials and issues sessions. */
export default function FrontDeskLoginPage() {
  return (
    <section className="card p-6 sm:p-8 max-w-md mx-auto space-y-6">
      <div>
        <p className="label mb-2">AI Front Desk</p>
        <h1 className="font-display text-2xl">Restaurant sign in</h1>
        <p className="text-ivory-dim text-sm mt-2">Use your restaurant slug and Front Desk account.</p>
      </div>
      <LoginForm />
    </section>
  );
}
