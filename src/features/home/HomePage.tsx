import { Link } from "react-router-dom";
import { AppLayout } from "../../app/layouts/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { useCommittees, useApprovalInbox } from "../../services/hooks";
import { committeeBadgeProps } from "../../domain/colors";
import { timeAgo } from "../../lib/format";

function QuickCard({ to, icon, title, sub, badge }: { to: string; icon: string; title: string; sub: string; badge?: number }) {
  return (
    <Link to={to} className="card mb-0" style={{ textDecoration: "none", color: "inherit", position: "relative" }}>
      <div style={{ fontSize: "1.6rem" }}>{icon}</div>
      <div className="bold">{title}</div>
      <div className="small muted">{sub}</div>
      {badge ? (
        <span className="badge badge--bad" style={{ position: "absolute", top: 10, insetInlineEnd: 10 }}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export default function HomePage() {
  const { user, isAdmin, hasGlobal } = useAuth();
  const { byId } = useCommittees();
  const inboxState = useApprovalInbox();

  const myCommittees = (user?.committeeIds ?? [])
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c && c.status === "active");

  const pendingAccounts = hasGlobal("users.review") ? inboxState.data.length : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء الخير";

  return (
    <AppLayout title="الرئيسية">
      <p className="muted small">
        {greeting}، <span className="bold">{user?.name}</span>
      </p>

      {pendingAccounts > 0 ? (
        <Link to="/admin" className="card card--bordered mb-1" style={{ textDecoration: "none", color: "inherit", ["--cc" as string]: "var(--warning)" }}>
          <div className="card__row">
            <span style={{ fontSize: "1.4rem" }}>🛡️</span>
            <div className="flex1">
              <div className="bold">{pendingAccounts} طلب حساب بانتظار القرار</div>
              <div className="small muted">افتح لوحة الإدارة للقبول أو الرفض بسبب</div>
            </div>
            <span className="badge badge--warn">جديد</span>
          </div>
        </Link>
      ) : null}
      <div className="grid-2">
        <QuickCard to="/students" icon="🎓" title="الطلاب" sub="بحث وفلترة وإدارة" />
        <QuickCard to="/requests" icon="📨" title="الطلبات" sub="واردة ومرسلة" />
        <QuickCard to="/finance" icon="💰" title="المالية" sub="الدخل والمصروف والرصيد" />
        <QuickCard to="/chat" icon="💬" title="الشات" sub="إعلانات ومجموعات" />
        <QuickCard to="/excel" icon="📊" title="Excel" sub="استيراد وتصدير" />
        {isAdmin ? <QuickCard to="/admin" icon="🛡️" title="الإدارة" sub="المستخدمون واللجان" badge={pendingAccounts || undefined} /> : null}
      </div>

      <div className="card">
        <div className="card__title">لجاني</div>
        {myCommittees.length === 0 ? (
          <p className="muted small mb-0">لم تُضف بعد إلى أي لجنة. تواصل مع الإدارة.</p>
        ) : (
          <div className="row">
            {myCommittees.map((c) => (
              <span key={c.id} {...committeeBadgeProps(c.colorKey)}>
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {user?.createdAt ? (
        <p className="tiny faint">عضو منذ {timeAgo(user.createdAt)}</p>
      ) : null}
    </AppLayout>
  );
}
