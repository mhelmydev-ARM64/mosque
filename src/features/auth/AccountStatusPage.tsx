import { useAuth } from "./AuthContext";
import { useAppearance } from "../../app/theme/ThemeProvider";
import { FONT_LABELS, PRIMARY_LABELS, THEME_LABELS } from "../../app/theme/ThemeProvider";
import type { FontSize, PrimaryColor, ThemeMode } from "../../app/theme/ThemeProvider";
import { USER_STATUS_LABELS } from "../../domain/requests";
import { Select } from "../../components/ui";
import { IconAlert, IconCheckCircle, IconClock, IconLogout, IconPalette, IconShield, IconUser } from "../../components/icons";

const TONES: Record<string, string> = {
  pending: "badge--warn",
  under_review: "badge--info",
  approved: "badge--ok",
  rejected: "badge--bad",
  suspended: "badge--bad",
};

const HINTS: Record<string, string> = {
  pending: "طلبك بانتظار مراجعة الإدارة. سيظهر القرار هنا تلقائيًا عند اتخاذه.",
  under_review: "حسابك قيد المراجعة حاليًا من قِبل الإدارة.",
  rejected: "تم رفض طلب الحساب. راجع السبب أدناه أو تواصل مع الإدارة.",
  suspended: "تم إيقاف حسابك مؤقتًا من قِبل الإدارة.",
};

const THEME_OPTIONS = (["auto", "light", "dark"] as ThemeMode[]).map((v) => ({
  value: v,
  label: THEME_LABELS[v],
}));

const FONT_OPTIONS = (["sm", "md", "lg", "xl"] as FontSize[]).map((v) => ({
  value: v,
  label: FONT_LABELS[v],
}));

const PRIMARY_OPTIONS = (["green", "blue", "indigo", "violet", "rose", "orange"] as PrimaryColor[]).map((v) => ({
  value: v,
  label: PRIMARY_LABELS[v],
}));

function statusIcon(status: string) {
  if (status === "approved") return <IconCheckCircle size={31} />;
  if (status === "rejected" || status === "suspended") return <IconAlert size={31} />;
  return <IconClock size={31} />;
}

function statusLogoClass(status: string) {
  if (status === "approved") return "auth-logo auth-logo--ok";
  if (status === "rejected" || status === "suspended") return "auth-logo auth-logo--bad";
  return "auth-logo auth-logo--warn";
}

export function AccountStatusPage() {
  const { user, logout } = useAuth();
  const { theme, fontSize, primary, setAppearance } = useAppearance();

  if (!user) return null;
  const label = USER_STATUS_LABELS[user.status] ?? user.status;
  const tone = TONES[user.status] ?? "";

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className={statusLogoClass(user.status)}>{statusIcon(user.status)}</div>
        <h1 className="auth-title">حالة الحساب</h1>
        <p className="auth-sub">آخر تحديث للحالة يظهر هنا تلقائيًا</p>

        <div className="card">
          <div className="card__title">
            <IconUser size={17} />
            بياناتك
          </div>
          <div className="kv">
            <span className="kv__k">الاسم</span>
            <span className="bold">{user.name}</span>
          </div>
          <div className="kv">
            <span className="kv__k">الهاتف</span>
            <span className="sw">{user.phone}</span>
          </div>
          <div className="kv">
            <span className="kv__k">الحالة</span>
            <span className={`badge ${tone}`}>{label}</span>
          </div>
        </div>

        <div className="card">
          <div className="card__title">
            <IconShield size={17} />
            قرار الإدارة
          </div>
          <p className="muted small">{HINTS[user.status] ?? "تابع هذه الصفحة لمعرفة قرار الإدارة."}</p>
          {user.decisionReason ? (
            <>
              <div className="label">سبب الإدارة</div>
              <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                {user.decisionReason}
              </p>
            </>
          ) : null}
        </div>

        <details className="card small muted">
          <summary className="bold appear-summary">
            <IconPalette size={16} />
            المظهر (يُحفظ على جهازك فقط)
          </summary>
          <div className="field mt-1">
            <span className="label">الثيم</span>
            <Select
              value={theme}
              onChange={(v) => setAppearance({ theme: v as ThemeMode })}
              options={THEME_OPTIONS}
            />
          </div>
          <div className="field">
            <span className="label">حجم الخط</span>
            <Select
              value={fontSize}
              onChange={(v) => setAppearance({ fontSize: v as FontSize })}
              options={FONT_OPTIONS}
            />
          </div>
          <div className="field">
            <span className="label">اللون الرئيسي</span>
            <Select
              value={primary}
              onChange={(v) => setAppearance({ primary: v as PrimaryColor })}
              options={PRIMARY_OPTIONS}
            />
          </div>
        </details>

        <button type="button" className="btn btn--block mt-1" onClick={() => void logout()}>
          <IconLogout size={17} />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
