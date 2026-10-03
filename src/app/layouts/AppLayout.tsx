import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth, useOnline } from "../../features/auth/AuthContext";
import { useAppearance } from "../theme/ThemeProvider";
import { USER_STATUS_LABELS } from "../../domain/requests";

const NAV = [
  { to: "/", label: "الرئيسية", ico: "🏠" },
  { to: "/students", label: "الطلاب", ico: "🎓" },
  { to: "/requests", label: "الطلبات", ico: "📨" },
  { to: "/chat", label: "الشات", ico: "💬" },
  { to: "/more", label: "المزيد", ico: "☰" },
];

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, isAdmin } = useAuth();
  const online = useOnline();
  const location = useLocation();
  const { resolvedTheme, setAppearance } = useAppearance();

  const showChatDot = false;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-header__title">{title}</h1>
        <span className="badge small nowrap">{USER_STATUS_LABELS[user?.status ?? "pending"]}</span>
        {isAdmin ? <NavLink to="/admin" className="icon-btn" title="لوحة الإدارة">🛡️</NavLink> : null}
        <button
          type="button"
          className="icon-btn"
          title="تبديل الثيم"
          onClick={() => setAppearance({ theme: resolvedTheme === "dark" ? "light" : "dark" })}
        >
          {resolvedTheme === "dark" ? "☀️" : "🌙"}
        </button>
        <NavLink to="/settings" className="icon-btn" title="الإعدادات" state={{ from: location.pathname }}>
          ⚙️
        </NavLink>
      </header>

      {!online ? <div className="conn-banner">⚠️ لا يوجد اتصال بالإنترنت — تعمل دون تحديث لحظي</div> : null}

      <main className="page">{children}</main>

      <nav className="bottom-nav" aria-label="التنقل الرئيسي">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="nav-ico" aria-hidden>
              {item.ico}
              {item.to === "/chat" && showChatDot ? <span className="nav-dot" /> : null}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
