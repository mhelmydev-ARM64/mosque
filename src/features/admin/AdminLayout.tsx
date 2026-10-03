import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useApprovalInbox } from '../../services/hooks';
import { EmptyState } from '../../components/ui';

const TABS = [
  { to: '/admin', label: 'طلبات الحسابات', end: true },
  { to: '/admin/users', label: 'المستخدمون' },
  { to: '/admin/committees', label: 'اللجان' },
  { to: '/admin/template', label: 'القالب' },
  { to: '/admin/routing', label: 'التوجيه' },
  { to: '/admin/channels', label: 'القنوات' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin, hasGlobal } = useAuth();
  const { data: inbox } = useApprovalInbox();
  const pendingCount = inbox.length;

  if (!isAdmin) {
    return <EmptyState icon="🔒" title="هذه الصفحة للإدارة فقط" sub="لا تملك دورًا إداريًا في التطبيق." />;
  }

  const visibleTabs = TABS.filter((t) => {
    if (t.to === '/admin') return hasGlobal('users.review');
    if (t.to === '/admin/users') return hasGlobal('users.review') || hasGlobal('users.managePermissions');
    if (t.to === '/admin/committees' || t.to === '/admin/channels' || t.to === '/admin/routing') return hasGlobal('committees.manage');
    if (t.to === '/admin/template') return hasGlobal('templates.manage');
    return true;
  });

  return (
    <div className="stack">
      <div className="row row--nowrap" style={{ alignItems: 'baseline' }}>
        <NavLink to="/" className="muted" aria-label="عودة">→</NavLink>
        <h1 className="page-title flex1">لوحة الإدارة</h1>
        {pendingCount > 0 && <span className="badge badge--warn">{pendingCount} بانتظار المراجعة</span>}
      </div>

      <nav className="tabs" aria-label="أقسام الإدارة">
        {visibleTabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${isActive ? 'tab--on' : ''}`}>
            {t.label}
            {t.to === '/admin' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </NavLink>
        ))}
      </nav>

      {children}
    </div>
  );
}
