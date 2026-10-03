import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginWithPhone, loginWithEmail, mapAuthError } from "../../services/atomicWrites";
import { useToast } from "../../components/ui";

export function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "phone") await loginWithPhone(phone, password);
      else await loginWithEmail(email, password);
      toast.showSuccess("تم تسجيل الدخول");
      navigate("/", { replace: true });
    } catch (err) {
      setError(mapAuthError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">📋</div>
        <h1 className="auth-title">إدارة اللجان والطلاب</h1>
        <p className="auth-title muted small mb-2">سجّل دخولك للمتابعة</p>

        <form onSubmit={submit} className="card">
          {mode === "phone" ? (
            <div className="field">
              <label className="label required" htmlFor="login-phone">
                رقم الهاتف
              </label>
              <input
                id="login-phone"
                className="input sw"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                placeholder="09xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <span className="help-text">مع رمز الدولة افتراضيًا 963 إن لم تكتبه</span>
            </div>
          ) : (
            <div className="field">
              <label className="label required" htmlFor="login-email">
                البريد الإداري
              </label>
              <input
                id="login-email"
                className="input sw"
                dir="ltr"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className="help-text">للحسابات الإدارية التي أنشئت ببريد مباشر</span>
            </div>
          )}

          <div className="field">
            <label className="label required" htmlFor="login-pass">
              كلمة المرور
            </label>
            <input
              id="login-pass"
              className="input"
              dir="ltr"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error ? <p className="error-text mb-1">{error}</p> : null}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "جارٍ الدخول..." : "دخول"}
          </button>

          <button
            type="button"
            className="btn btn--ghost btn--block btn--sm mt-1"
            onClick={() => setMode((m) => (m === "phone" ? "email" : "phone"))}
          >
            {mode === "phone" ? "الدخول ببريد إداري بدلًا من الهاتف" : "الدخول برقم الهاتف"}
          </button>
        </form>

        <p className="auth-title small">
          ليس لديك حساب؟ <Link to="/register">إنشاء حساب جديد</Link>
        </p>
      </div>
    </div>
  );
}
