import { useAuth } from "./AuthContext";
import { useAppearance } from "../../app/theme/ThemeProvider";
import { USER_STATUS_LABELS } from "../../domain/requests";

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

export function AccountStatusPage() {
  const { user, logout } = useAuth();
  const { theme, fontSize, primary, setAppearance } = useAppearance();

  if (!user) return null;
  const label = USER_STATUS_LABELS[user.status] ?? user.status;
  const tone = TONES[user.status] ?? "";

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">{user.status === "approved" ? "🎉" : "⏳"}</div>
        <h1 className="auth-title">حالة الحساب</h1>

        <div className="card">
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
          <p className="muted small">{HINTS[user.status] ?? ""}</p>
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
          <summary className="bold">المظهر (يُحفظ على جهازك فقط)</summary>
          <div className="field mt-1">
            <span className="label">الثيم</span>
            <select className="select" value={theme} onChange={(e) => setAppearance({ theme: e.target.value as typeof theme })}>
              <option value="auto">تلقائي حسب الجهاز</option>
              <option value="light">فاتح</option>
              <option value="dark">داكن</option>
            </select>
          </div>
          <div className="field">
            <span className="label">حجم الخط</span>
            <select className="select" value={fontSize} onChange={(e) => setAppearance({ fontSize: e.target.value as typeof fontSize })}>
              <option value="sm">صغير</option>
              <option value="md">متوسط</option>
              <option value="lg">كبير</option>
              <option value="xl">كبير جدًا</option>
            </select>
          </div>
          <div className="field">
            <span className="label">اللون الرئيسي</span>
            <select className="select" value={primary} onChange={(e) => setAppearance({ primary: e.target.value as typeof primary })}>
              <option value="green">أخضر</option>
              <option value="blue">أزرق</option>
              <option value="indigo">نيلي</option>
              <option value="violet">بنفسجي</option>
              <option value="rose">وردي</option>
              <option value="orange">برتقالي</option>
            </select>
          </div>
        </details>

        <button type="button" className="btn btn--block" onClick={() => void logout()}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
