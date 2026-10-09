import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginWithPhone, loginWithEmail, mapAuthError } from "../../services/atomicWrites";
import { PasswordInput, useToast } from "../../components/ui";
import { IconCommittee, IconEmail, IconPhone } from "../../components/icons";

export function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
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
        <div className="auth-logo">
          <IconCommittee size={32} />
        </div>
        <h1 className="auth-title">إدارة اللجان والطلاب</h1>
        <p className="auth-sub">سجّل دخولك للمتابعة</p>

        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "phone"}
            className={`tab ${mode === "phone" ? "tab--on" : ""}`}
            onClick={() => { setMode("phone"); setError(""); }}
          >
            <IconPhone size={16} />
            رقم الهاتف
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "email"}
            className={`tab ${mode === "email" ? "tab--on" : ""}`}
            onClick={() => { setMode("email"); setError(""); }}
          >
            <IconEmail size={16} />
            بريد إداري
          </button>
        </div>

        <form onSubmit={submit} className="card">
          {mode === "phone" ? (
            <div className="field">
              <label className="label required" htmlFor="login-phone">رقم الهاتف</label>
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
              <label className="label required" htmlFor="login-email">البريد الإداري</label>
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
            <label className="label required" htmlFor="login-pass">كلمة المرور</label>
            <PasswordInput
              id="login-pass"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              minLength={6}
            />
          </div>

          {error ? <p className="error-text mb-1">{error}</p> : null}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>

        <p className="auth-title small">
          ليس لديك حساب؟ <Link to="/register">إنشاء حساب جديد</Link>
        </p>
      </div>
    </div>
  );
}
