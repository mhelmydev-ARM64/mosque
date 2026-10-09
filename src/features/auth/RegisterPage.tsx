import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerAccount, mapAuthError } from "../../services/atomicWrites";
import { PasswordInput, useToast } from "../../components/ui";
import { IconInfo, IconUserPlus } from "../../components/icons";

export function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("كلمة المرور 8 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    try {
      await registerAccount({ name: name.trim(), phoneRaw: phone, password });
      toast.showSuccess("أُنشئ حسابك وهو بانتظار موافقة الإدارة");
      navigate("/status", { replace: true });
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
          <IconUserPlus size={30} />
        </div>
        <h1 className="auth-title">إنشاء حساب جديد</h1>
        <p className="auth-sub">يصل طلبك للإدارة داخل التطبيق للموافقة عليه</p>

        <form onSubmit={submit} className="card">
          <div className="field">
            <label className="label required" htmlFor="reg-name">الاسم الكامل</label>
            <input
              id="reg-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              placeholder="مثال: أحمد محمد"
            />
          </div>

          <div className="field">
            <label className="label required" htmlFor="reg-phone">رقم الهاتف</label>
            <input
              id="reg-phone"
              className="input sw"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <span className="help-text">يستخدم للدخول لاحقًا. رمز الدولة 963 افتراضيًا</span>
          </div>

          <div className="field">
            <label className="label required" htmlFor="reg-pass">كلمة المرور</label>
            <PasswordInput id="reg-pass" value={password} onChange={setPassword} autoComplete="new-password" minLength={6} />
            <span className="help-text">6 أحرف على الأقل. القيمة الأقوى 8 أو أكثر.</span>
          </div>

          <div className="field">
            <label className="label required" htmlFor="reg-confirm">تأكيد كلمة المرور</label>
            <PasswordInput id="reg-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={6} />
          </div>

          {error ? <p className="error-text mb-1">{error}</p> : null}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}
          </button>
        </form>

        <div className="notice notice--info">
          <IconInfo size={17} />
          <span>
            لا تستطيع الدخول قبل موافقة الإدارة، ويمكنك متابعة حالة طلبك من صفحة الحالة.
          </span>
        </div>

        <p className="auth-title small">
          لديك حساب؟ <Link to="/login">تسجيل الدخول</Link>
        </p>
      </div>
    </div>
  );
}
