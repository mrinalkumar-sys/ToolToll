
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, UserRound, Mail, LockKeyhole } from "lucide-react";
import "../auth.css";

type AccountRole = "owner" | "creator";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("owner");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || password.length < 8) {
      setError("Enter your name, a valid email, and a password of at least 8 characters.");
      return;
    }

    // Temporary frontend demo navigation. No account is created on a server.
    navigate(role === "creator" ? "/creator/tools" : "/owner/wallet");
  }

  return (
    <main className="auth-page">
      <Link to="/" className="auth-back">
        <ArrowLeft size={17} /> Back to home
      </Link>

      <section className="auth-card">
        <Link to="/" className="brand auth-brand">
          <span className="brand-icon"><Coins size={22} /></span>
          <span>ToolToll</span>
        </Link>

        <div className="auth-heading">
          <h1>Create your account</h1>
          <p>Choose how you want to use ToolToll.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="name">Full name</label>
          <div className="auth-input-wrap">
            <UserRound size={18} />
            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Your full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <label htmlFor="register-email">Email address</label>
          <div className="auth-input-wrap">
            <Mail size={18} />
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <label htmlFor="register-password">Password</label>
          <div className="auth-input-wrap">
            <LockKeyhole size={18} />
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <label htmlFor="role">Account type</label>
          <select
            id="role"
            className="auth-select"
            value={role}
            onChange={(event) => setRole(event.target.value as AccountRole)}
          >
            <option value="owner">Agent owner — use tools</option>
            <option value="creator">Tool creator — publish tools</option>
          </select>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" className="button button-primary auth-submit">
            Create account
          </button>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>

        <p className="auth-disclaimer">
          Demo mode: registration is not saved to a server yet.
        </p>
      </section>
    </main>
  );
}
