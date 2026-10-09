import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "../../app/layouts/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { useCommittees, useApprovalInbox } from "../../services/hooks";
import { committeeBadgeProps } from "../../domain/colors";
import { timeAgo } from "../../lib/format";
import {
  IconAlert,
  IconCap,
  IconChart,
  IconChat,
  IconCommittee,
  IconMoney,
  IconSend,
  IconShield,
  IconUser,
} from "../../components/icons";

function QuickCard({ to, icon, title, sub, badge }: { to: string; icon: ReactNode; title: string; sub: string; badge?: number }) {
  return (
    <Link to={to} className="quick-card">
      <span className="quick-card__ico">{icon}</span>
      <span className="quick-card__title">{title}</span>
      <span className="quick-card__sub">{sub}</span>
      {badge ? <span className="badge badge--bad quick-card__badge">{badge}</span> : null}
    </Link>
  );
}

function greetingFor(hour: number): string {
  if (hour < 5) return "طاب سهرك";
  if (hour < 12) return "صباح الخير";
  if (hour < 17) return "طاب يومك";
  if (hour < 21) return "مساء الخير";
  return "طاب مساؤك";
}

export default function HomePage() {
  const { user, isAdmin, isSuperAdmin, hasGlobal } = useAuth();
  const { committees, byId } = useCommittees();
  const inboxState = useApprovalInbox();

  const myCommittees = (user?.committeeIds ?? [])
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c && c.status === "active");
  const listedCommittees = isSuperAdmin ? committees.filter((c) => c.status === "active") : myCommittees;

  const pendingAccounts = hasGlobal("users.review") ? inboxState.data.length : 0;
  const greeting = greetingFor(new Date().getHours());

  return (
    <AppLayout title="الرئيسية">
      <div className="hero-card">
        <span className="hero-card__ico">
          <IconUser size={24} />
        </span>
        <div className="flex1">
          <div className="hero-card__title">
            {greeting}، {user?.name}
          </div>
          <div className="hero-card__sub">
            {isSuperAdmin
              ? "مدير عام — يرى ويدير كل اللجان والصلاحيات."
              : myCommittees.length === 0
                ? "لم تُضف إلى أي لجنة بعد — تواصل مع الإدارة."
                : `عضو في ${myCommittees.length === 1 ? "لجنة واحدة" : `${myCommittees.length} لجان`}.`}
          </div>
        </div>
      </div>

      {pendingAccounts > 0 ? (
        <Link to="/admin" className="hero-card hero-card--warn">
          <span className="hero-card__ico">
            <IconAlert size={24} />
          </span>
          <div className="flex1">
            <div className="hero-card__title">{pendingAccounts} طلب حساب بانتظار القرار</div>
            <div className="hero-card__sub">افتح لوحة الإدارة للقبول أو الرفض بسبب موثّق</div>
          </div>
          <span className="badge badge--warn">جديد</span>
        </Link>
      ) : null}

      <div className="section-title">الوصول السريع</div>
      <div className="quick-grid">
        <QuickCard to="/students" icon={<IconCap size={21} />} title="الطلاب" sub="بحث وفلترة وإدارة" />
        <QuickCard to="/requests" icon={<IconSend size={21} />} title="الطلبات" sub="واردة ومرسلة وقرارات" />
        <QuickCard to="/finance" icon={<IconMoney size={21} />} title="المالية" sub="الدخل والمصروف والرصيد" />
        <QuickCard to="/chat" icon={<IconChat size={21} />} title="الشات" sub="إعلانات ومجموعات" />
        <QuickCard to="/excel" icon={<IconChart size={21} />} title="Excel" sub="استيراد وتصدير ونسخ" />
        {isAdmin ? (
          <QuickCard
            to="/admin"
            icon={<IconShield size={21} />}
            title="الإدارة"
            sub="المستخدمون واللجان والقالب"
            badge={pendingAccounts || undefined}
          />
        ) : null}
      </div>

      <div className="card">
        <div className="card__title">
          <IconCommittee size={17} />
          {isSuperAdmin ? "كل اللجان" : "لجاني"}
        </div>
        {listedCommittees.length === 0 ? (
          <p className="muted small mb-0">
            {isSuperAdmin ? "لا لجان بعد — أنشئ أول لجنة من لوحة الإدارة." : "لم تُضف بعد إلى أي لجنة. تواصل مع الإدارة."}
          </p>
        ) : (
          <div className="row">
            {listedCommittees.map((c) => (
              <span key={c.id} {...committeeBadgeProps(c.colorKey)}>
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {user?.createdAt ? <p className="tiny faint">عضو منذ {timeAgo(user.createdAt)}</p> : null}
    </AppLayout>
  );
}
