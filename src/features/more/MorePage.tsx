import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "../../app/layouts/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { useCommittees } from "../../services/hooks";
import { committeeBadgeProps } from "../../domain/colors";
import {
  IconArrowStart,
  IconCap,
  IconChart,
  IconChat,
  IconMoney,
  IconSend,
  IconSettings,
  IconShield,
  IconUser,
} from "../../components/icons";

interface MoreLink {
  to: string;
  icon: ReactNode;
  title: string;
  sub: string;
  show: boolean;
}

export default function MorePage() {
  const { user, isAdmin, isSuperAdmin, hasGlobal } = useAuth();
  const { byId } = useCommittees();

  const links: MoreLink[] = [
    { to: "/students", icon: <IconCap size={20} />, title: "الطلاب", sub: "بحث، فلترة، إضافة وتعديل", show: true },
    { to: "/requests", icon: <IconSend size={20} />, title: "الطلبات", sub: "إرسال واستقبال وقرارات", show: true },
    { to: "/finance", icon: <IconMoney size={20} />, title: "السجل المالي", sub: "الدخل والمصروف والرصيد", show: true },
    { to: "/chat", icon: <IconChat size={20} />, title: "الإعلانات والشات", sub: "قنوات التواصل", show: true },
    { to: "/excel", icon: <IconChart size={20} />, title: "Excel والنسخ الاحتياطية", sub: "استيراد وتصدير ونسخة", show: true },
    { to: "/admin", icon: <IconShield size={20} />, title: "لوحة الإدارة", sub: "الحسابات واللجان والقالب", show: isAdmin },
    { to: "/settings", icon: <IconSettings size={20} />, title: "الإعدادات والمظهر", sub: "الثيم وحجم الخط وكلمة المرور", show: true },
  ];

  return (
    <AppLayout title="المزيد">
      <div className="list">
        {links
          .filter((l) => l.show)
          .map((l) => (
            <Link key={l.to} to={l.to} className="list-row">
              <span className="list-row__ico">{l.icon}</span>
              <div className="list-row__main">
                <div className="list-row__title">{l.title}</div>
                <div className="list-row__sub">{l.sub}</div>
              </div>
              <span className="list-row__end">
                <IconArrowStart size={17} />
              </span>
            </Link>
          ))}
      </div>

      <div className="card mt-2">
        <div className="card__title">
          <IconUser size={17} />
          حسابي
        </div>
        <div className="kv"><span className="kv__k">الاسم</span><span className="bold">{user?.name}</span></div>
        <div className="kv"><span className="kv__k">الهاتف</span><span className="sw">{user?.phone}</span></div>
        <div className="kv">
          <span className="kv__k">اللجان</span>
          <span className="row">
            {(user?.committeeIds ?? []).map((id) => {
              const c = byId.get(id);
              return c ? <span key={id} {...committeeBadgeProps(c.colorKey)}>{c.name}</span> : null;
            })}
            {(user?.committeeIds ?? []).length === 0 ? (
              <span className="faint small">{isSuperAdmin ? "مدير عام — يشرف على كل اللجان" : "لا شيء"}</span>
            ) : null}
          </span>
        </div>
        {hasGlobal("backup.export") ? <p className="tiny faint mt-1">لديك صلاحية إنشاء النسخ الاحتياطية.</p> : null}
      </div>
    </AppLayout>
  );
}
