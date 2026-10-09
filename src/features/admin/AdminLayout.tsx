import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useApprovalInbox } from '../../services/hooks';
import { EmptyState } from '../../components/ui';
import {
  IconArrowStart,
  IconCap,
  IconChat,
  IconClipboard,
  IconCommittee,
  IconInbox,
  IconLock,
  IconRoute,
  IconTasks,
  IconUsers,
} from '../../components/icons';

const TABS = [
  { to: '/admin', label: 'طلبات الحسابات', end: true, Icon: IconInbox },
  { to: '/admin/users', label: 'المستخدمون', Icon: IconUsers },
  { to: '/admin/committees', label: 'اللجان', Icon: IconCommittee },
  { to: '/admin/tasks', label: 'المهام والتقارير', Icon: IconTasks },
  { to: '/admin/directory', label: 'دليل الطلاب', Icon: IconCap },
  { to: '/admin/template', label: 'القالب', Icon: IconClipboard },
  { to: '/admin/routing', label: 'التوجيه', Icon: IconRoute },
  { to: '/admin/channels', label: 'القنوات', Icon: IconChat },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin, hasGlobal } = useAuth();
  const { data: inbox } = useApprovalInbox();
  const pendingCount = inbox.length;

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<IconLock size={30} />}
        title="هذه الصفحة للإدارة فقط"
        sub="لا تملك دورًا إداريًا في التطبيق."
      />
    );
  }

  const visibleTabs = TABS.filter((t) => {
    if (t.to === '/admin') return hasGlobal('users.review');
    if (t.to === '/admin/users') return hasGlobal('users.review') || hasGlobal('users.managePermissions');
    if (t.to === '/admin/directory') return hasGlobal('students.oversight');
    if (t.to === '/admin/tasks') return hasGlobal('requests.oversight') || hasGlobal('committees.manage');
    if (t.to === '/admin/committees' || t.to === '/admin/channels' || t.to === '/admin/routing') return hasGlobal('committees.manage');
    if (t.to === '/admin/template') return hasGlobal('templates.manage');
    return true;
  });

  return (
    <div className="stack">
      <div className="row row--nowrap">
        <NavLink to="/" className="icon-btn" aria-label="عودة إلى التطبيق">
          <IconArrowStart size={19} />
        </NavLink>
        <h1 className="page-title flex1">لوحة الإدارة</h1>
        {pendingCount > 0 ? <span className="badge badge--warn">{pendingCount} بانتظار المراجعة</span> : null}
      </div>

      <nav className="tabs tabs--wrap" aria-label="أقسام الإدارة">
        {visibleTabs.map(({ to, label, end, Icon }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab ${isActive ? 'tab--on' : ''}`}>
            <Icon size={16} />
            <span>{label}</span>
            {to === '/admin' && pendingCount > 0 ? <span className="tab__count">{pendingCount}</span> : null}
          </NavLink>
        ))}
      </nav>

      {children}
    </div>
  );
}
