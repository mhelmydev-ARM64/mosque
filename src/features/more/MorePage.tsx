import { Link } from "react-router-dom";
import { AppLayout } from "../../app/layouts/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { useCommittees } from "../../services/hooks";
import { committeeBadgeProps } from "../../domain/colors";

export default function MorePage() {
  const { user, isAdmin, hasGlobal } = useAuth();
  const { byId } = useCommittees();

  const links: { to: string; icon: string; title: string; sub: string; show: boolean }[] = [
    { to: "/students", icon: "🎓", title: "الطلاب", sub: "بحث، فلترة، إضافة وتعديل", show: true },
    { to: "/requests", icon: "📨", title: "الطلبات", sub: "إرسال واستقبال وقرارات", show: true },
    { to: "/finance", icon: "💰", title: "السجل المالي", sub: "الدخل والمصروف والرصيد", show: true },
    { to: "/chat", icon: "💬", title: "الإعلانات والشات", sub: "قنوات التواصل", show: true },
    { to: "/excel", icon: "📊", title: "Excel والنسخ الاحتياطية", sub: "استيراد وتصدير ونسخة", show: true },
    { to: "/admin", icon: "🛡️", title: "لوحة الإدارة", sub: "الحسابات واللجان والقالب", show: isAdmin },
    { to: "/settings", icon: "⚙️", title: "الإعدادات والمظهر", sub: "الثيم وحجم الخط وكلمة المرور", show: true },
  ];

  return (
    <AppLayout title="المزيد">
      <div className="list">
        {links
          .filter((l) => l.show)
          .map((l) => (
            <Link key={l.to} to={l.to} className="list-row" style={{ textDecoration: "none", color: "inherit" }}>
              <span style={{ fontSize: "1.3rem" }}>{l.icon}</span>
              <div className="list-row__main">
                <div className="list-row__title">{l.title}</div>
                <div className="list-row__sub">{l.sub}</div>
              </div>
              <span className="faint">‹</span>
            </Link>
          ))}
      </div>

      <div className="card mt-2">
        <div className="card__title">حسابي</div>
        <div className="kv"><span className="kv__k">الاسم</span><span className="bold">{user?.name}</span></div>
        <div className="kv"><span className="kv__k">الهاتف</span><span className="sw">{user?.phone}</span></div>
        <div className="kv">
          <span className="kv__k">اللجان</span>
          <span className="row">
            {(user?.committeeIds ?? []).map((id) => {
              const c = byId.get(id);
              return c ? <span key={id} {...committeeBadgeProps(c.colorKey)}>{c.name}</span> : null;
            })}
            {(user?.committeeIds ?? []).length === 0 ? <span className="faint small">لا شيء</span> : null}
          </span>
        </div>
        {hasGlobal("backup.export") ? <p className="tiny faint mt-1">لديك صلاحية إنشاء النسخ الاحتياطية.</p> : null}
      </div>
    </AppLayout>
  );
}
