import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth, useOnline } from "../../features/auth/AuthContext";
import { useAppearance } from "../../app/theme/ThemeProvider";
import { USER_STATUS_LABELS } from "../../domain/requests";
import {
  IconAlert,
  IconCap,
  IconChat,
  IconGrid,
  IconHome,
  IconMoon,
  IconSend,
  IconSettings,
  IconShield,
  IconSun,
} from "../../components/icons";

const NAV = [
  { to: "/", label: "الرئيسية", Icon: IconHome },
  { to: "/students", label: "الطلاب", Icon: IconCap },
  { to: "/requests", label: "الطلبات", Icon: IconSend },
  { to: "/chat", label: "الشات", Icon: IconChat },
  { to: "/more", label: "المزيد", Icon: IconGrid },
];

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, isAdmin } = useAuth();
  const online = useOnline();
  const location = useLocation();
  const { resolvedTheme, setAppearance } = useAppearance();

  const showChatDot = false;
  const ThemeIcon = resolvedTheme === "dark" ? IconSun : IconMoon;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-header__title">{title}</h1>
        <div className="app-header__actions">
          <span className="badge small nowrap">{USER_STATUS_LABELS[user?.status ?? "pending"]}</span>
          {isAdmin ? (
            <NavLink to="/admin" className="icon-btn icon-btn--primary" title="لوحة الإدارة" aria-label="لوحة الإدارة">
              <IconShield size={19} />
            </NavLink>
          ) : null}
          <button
            type="button"
            className="icon-btn"
            title="تبديل الثيم"
            aria-label={resolvedTheme === "dark" ? "تحويل للوضع الفاتح" : "تحويل للوضع الداكن"}
            onClick={() => setAppearance({ theme: resolvedTheme === "dark" ? "light" : "dark" })}
          >
            <ThemeIcon size={19} />
          </button>
          <NavLink to="/settings" className="icon-btn" title="الإعدادات" aria-label="الإعدادات" state={{ from: location.pathname }}>
            <IconSettings size={19} />
          </NavLink>
        </div>
      </header>

      {!online ? (
        <div className="conn-banner">
          <IconAlert size={15} />
          <span>لا يوجد اتصال بالإنترنت — تعمل دون تحديث لحظي</span>
        </div>
      ) : null}

      <main className="page">{children}</main>

      <nav className="bottom-nav" aria-label="التنقل الرئيسي">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="nav-ico" aria-hidden="true">
              <Icon size={21} />
              {to === "/chat" && showChatDot ? <span className="nav-dot" /> : null}
            </span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
