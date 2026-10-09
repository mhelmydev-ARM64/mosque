import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AppLayout } from "../../app/layouts/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { useAppearance, THEME_LABELS, FONT_LABELS, PRIMARY_LABELS } from "../../app/theme/ThemeProvider";
import type { ThemeMode, FontSize, PrimaryColor } from "../../app/theme/ThemeProvider";
import { changePassword, mapAuthError } from "../../services/atomicWrites";
import { useToast } from "../../components/ui";
import { PRIMARY_SWATCHES } from "../../domain/themeChoices";
import {
  IconDevice,
  IconKey,
  IconLogout,
  IconMoon,
  IconPalette,
  IconSun,
  IconText,
  IconUser,
} from "../../components/icons";

const THEME_ICONS: Record<ThemeMode, ReactNode> = {
  light: <IconSun size={19} />,
  dark: <IconMoon size={19} />,
  auto: <IconDevice size={19} />,
};

const THEME_HINTS: Record<ThemeMode, string> = {
  light: "خلفية فاتحة دائمًا",
  dark: "خلفية داكنة دائمًا",
  auto: "يتبع إعداد جهازك",
};

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { theme, fontSize, primary, setAppearance } = useAppearance();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    if (next.length < 8) {
      setMsg("كلمة المرور الجديدة 8 أحرف على الأقل");
      return;
    }
    if (next !== confirm) {
      setMsg("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.showSuccess("تم تغيير كلمة المرور");
    } catch (err) {
      toast.showError(mapAuthError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout title="الإعدادات">
      <div className="card">
        <div className="card__title">
          <IconPalette size={17} />
          المظهر
          <span className="tiny faint">يُحفظ على جهازك فقط</span>
        </div>

        <div className="field">
          <span className="label">الثيم</span>
          <div className="theme-opts">
            {(["light", "dark", "auto"] as ThemeMode[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`theme-opt ${theme === t ? "is-on" : ""}`}
                aria-pressed={theme === t}
                onClick={() => setAppearance({ theme: t })}
              >
                {THEME_ICONS[t]}
                <span>{THEME_LABELS[t]}</span>
                <small>{THEME_HINTS[t]}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">حجم الخط</span>
          <div className="row">
            {(["sm", "md", "lg", "xl"] as FontSize[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`chip ${fontSize === f ? "chip--on" : ""}`}
                aria-pressed={fontSize === f}
                onClick={() => setAppearance({ fontSize: f })}
              >
                {FONT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">اللون الرئيسي</span>
          <div className="row">
            {(Object.keys(PRIMARY_LABELS) as PrimaryColor[]).map((p) => (
              <button
                key={p}
                type="button"
                title={PRIMARY_LABELS[p]}
                aria-label={PRIMARY_LABELS[p]}
                aria-pressed={primary === p}
                className={`swatch ${primary === p ? "swatch--on" : ""}`}
                style={{ background: PRIMARY_SWATCHES[p] }}
                onClick={() => setAppearance({ primary: p })}
              />
            ))}
          </div>
          <span className="help-text">اللون الحالي: {PRIMARY_LABELS[primary]}</span>
        </div>

        <div className="appear-preview">
          <div className="appear-preview__row">
            <button type="button" className="btn btn--primary btn--sm" tabIndex={-1}>زر رئيسي</button>
            <span className="badge badge--primary">شارة</span>
            <span className="chip chip--on">خيار</span>
            <span className="muted small">هكذا ستظهر العناصر بلونك المختار.</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__title">
          <IconKey size={17} />
          تغيير كلمة المرور
        </div>
        <form onSubmit={onChangePassword}>
          <div className="field">
            <label className="label required" htmlFor="cur-pass">كلمة المرور الحالية</label>
            <input id="cur-pass" className="input" dir="ltr" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label required" htmlFor="new-pass">كلمة المرور الجديدة</label>
            <input id="new-pass" className="input" dir="ltr" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
            <span className="help-text">8 أحرف على الأقل.</span>
          </div>
          <div className="field">
            <label className="label required" htmlFor="conf-pass">تأكيد الجديدة</label>
            <input id="conf-pass" className="input" dir="ltr" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
          </div>
          {msg ? <p className="error-text mb-1">{msg}</p> : null}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card__title">
          <IconUser size={17} />
          الحساب
        </div>
        <div className="kv"><span className="kv__k">الاسم</span><span className="bold">{user?.name}</span></div>
        <div className="kv"><span className="kv__k">الهاتف</span><span className="sw">{user?.phone}</span></div>
        <p className="tiny faint mt-1">
          لتثبيت التطبيق على هاتفك: افتح قائمة المتصفح واختر «إضافة إلى الشاشة الرئيسية».
        </p>
        <button type="button" className="btn btn--danger btn--block mt-1" onClick={() => void logout()}>
          <IconLogout size={17} />
          تسجيل الخروج
        </button>
      </div>

      <p className="tiny faint" style={{ textAlign: "center" }}>
        <IconText size={13} /> إدارة اللجان والطلاب — نسخة مجانية بالكامل (GitHub Pages + Firebase Spark)
      </p>
    </AppLayout>
  );
}
