import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCommittees, useMyChannelReads, useVisibleChannels } from '../../services/hooks';
import { Loading, EmptyState } from '../../components/ui';
import { committeeBadgeProps } from '../../domain/colors';
import type { Channel } from '../../domain/models';

export default function ChatListPage() {
  const { user } = useAuth();
  const { data: channels, loading, error } = useVisibleChannels(user);
  const { byId } = useCommittees();
  const { data: reads } = useMyChannelReads(user?.uid ?? null);

  const lastReadAt = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reads) map.set(r.channelId, r.lastReadAt?.toMillis() ?? 0);
    return map;
  }, [reads]);

  const sorted = useMemo(
    () => [...channels].sort((a, b) => (b.lastActivityAt?.toMillis() ?? 0) - (a.lastActivityAt?.toMillis() ?? 0)),
    [channels]
  );
  const announcements = sorted.filter((c) => c.type === 'announcements');
  const discussions = sorted.filter((c) => c.type === 'discussion');

  const hasNew = (ch: Channel) => {
    const seen = lastReadAt.get(ch.id) ?? 0;
    return (ch.lastActivityAt?.toMillis() ?? 0) > seen;
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superAdmin';

  return (
    <div className="stack">
      <h1 className="page-title">الشات</h1>
      {loading && <Loading />}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && channels.length === 0 && (
        <EmptyState icon="💬" title="لا توجد قنوات متاحة بعد" sub="ستظهر مجموعات الإعلانات والدردشة هنا عندما ينشئها المدير." />
      )}

      {announcements.length > 0 && (
        <section>
          <h2 className="section-title">📢 الإعلانات</h2>
          <div className="list">
            {announcements.map((ch) => (
              <Link
                key={ch.id}
                to={`/chat/${ch.id}`}
                className={`list-row ${ch.status === 'archived' ? 'list-row--muted' : ''}`}
              >
                <div className="list-row__main">
                  <span className="list-row__title">
                    {ch.name}
                    {hasNew(ch) && ch.status === 'active' && <span className="dot-new" aria-label="رسائل جديدة" />}
                  </span>
                  <span className="list-row__sub">
                    {ch.status === 'archived' ? 'معطّلة' : isAdmin ? 'تستطيع النشر' : 'للقراءة فقط'}
                  </span>
                </div>
                <span className="muted">‹</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {discussions.length > 0 && (
        <section>
          <h2 className="section-title">💬 مجموعات الدردشة</h2>
          <div className="list">
            {discussions.map((ch) => (
              <Link key={ch.id} to={`/chat/${ch.id}`} className="list-row">
                <div className="list-row__main">
                  <span className="list-row__title">
                    {ch.name}
                    {hasNew(ch) && <span className="dot-new" aria-label="رسائل جديدة" />}
                  </span>
                  <span className="chips">
                    {ch.committeeIds.map((cid) => {
                      const c = byId.get(cid);
                      return c ? (
                        <span key={cid} {...committeeBadgeProps(c.colorKey)}>
                          {c.name}
                        </span>
                      ) : null;
                    })}
                  </span>
                </div>
                <span className="muted">‹</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isAdmin && (
        <Link to="/admin/channels" className="btn btn--ghost">
          إدارة القنوات
        </Link>
      )}
    </div>
  );
}
