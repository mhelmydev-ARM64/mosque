import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  onSnapshot,
  query,
  startAfter,
  type CollectionReference,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, firebaseReady } from '../../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import { errText, useCommittees, useProfilesIn, useVisibleChannels } from '../../services/hooks';
import { hideMessage, markChannelRead, sendMessage } from '../../services/atomicWrites';
import { Loading, EmptyState, useToast } from '../../components/ui';
import { committeeBadgeProps } from '../../domain/colors';
import type { ChannelMessage } from '../../domain/models';

const PAGE = 50;

export default function ChatChannelPage() {
  const { channelId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data: channels, loading: chLoading } = useVisibleChannels(user);
  const channel = useMemo(() => channels.find((c) => c.id === channelId) ?? null, [channels, channelId]);
  const { byId } = useCommittees();
  const { data: profiles } = useProfilesIn(channel?.committeeIds ?? []);

  const isAdmin = user?.role === 'admin' || user?.role === 'superAdmin';
  const canPost = !!channel && channel.status === 'active' && (channel.type === 'discussion' || isAdmin);

  const [live, setLive] = useState<ChannelMessage[]>([]);
  const [older, setOlder] = useState<ChannelMessage[]>([]);
  const [oldestSnap, setOldestSnap] = useState<QueryDocumentSnapshot<ChannelMessage> | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const nearBottom = useRef(true);

  const chId = channel?.id ?? null;
  const msgsRef = useMemo(
    () =>
      firebaseReady && db && chId
        ? (collection(db, 'channels', chId, 'messages') as CollectionReference<ChannelMessage>)
        : null,
    [chId]
  );

  useEffect(() => {
    if (!msgsRef || !channel) return;
    setLive([]);
    setOlder([]);
    setOldestSnap(null);
    setHasMore(true);
    setLoadingMsgs(true);
    const q = query(msgsRef, orderBy('createdAt', 'desc'), limit(PAGE));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLive(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChannelMessage, 'id'>) })));
        setOldestSnap(snap.docs[snap.docs.length - 1] ?? null);
        if (snap.docs.length < PAGE) setHasMore(false);
        setLoadingMsgs(false);
      },
      (e) => {
        toast.showError(errText(e));
        setLoadingMsgs(false);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgsRef]);

  const all = useMemo(() => [...older, ...[...live].reverse()], [older, live]);

  const newest = live[0] ?? null;
  useEffect(() => {
    if (!channel || !user || !newest) return;
    markChannelRead(user.uid, channel, newest.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id, newest?.id]);

  useEffect(() => {
    if (nearBottom.current) endRef.current?.scrollIntoView({ block: 'end' });
  }, [all.length]);

  async function loadOlder() {
    if (!msgsRef || !oldestSnap || loadingMore) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(query(msgsRef, orderBy('createdAt', 'desc'), startAfter(oldestSnap), limit(PAGE)));
      const page = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChannelMessage, 'id'>) }));
      setOlder((prev) => [...page.reverse(), ...prev]);
      setOldestSnap(snap.docs[snap.docs.length - 1] ?? oldestSnap);
      if (snap.docs.length < PAGE) setHasMore(false);
    } catch (e) {
      toast.showError(errText(e));
    }
    setLoadingMore(false);
  }

  async function send() {
    const body = text.trim();
    if (!body || !channel || !user || sending) return;
    setSending(true);
    try {
      await sendMessage(channel, body, user);
      setText('');
      nearBottom.current = true;
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر إرسال الرسالة');
    }
    setSending(false);
  }

  async function toggleHidden(m: ChannelMessage) {
    if (!channel) return;
    try {
      await hideMessage(channel.id, m.id, !m.hidden);
    } catch (e) {
      toast.showError((e as Error).message || 'تعذر تنفيذ العملية');
    }
  }

  const committeeByUid = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) {
      const cid = p.committeeIds.find((c) => channel?.committeeIds.includes(c));
      if (cid && byId.has(cid)) map.set(p.uid, byId.get(cid)!.name);
    }
    return map;
  }, [profiles, byId, channel?.committeeIds]);

  if (chLoading) return <Loading />;
  if (!channel)
    return (
      <div className="stack">
        <EmptyState
          icon="🚫"
          title="القناة غير موجودة"
          sub="ربما حُذفت أو لا تملك صلاحية الوصول إليها."
        />
        <Link to="/chat" className="btn btn--ghost">
          عودة للشات
        </Link>
      </div>
    );

  const visible = all.filter((m) => isAdmin || !m.hidden);

  return (
    <div className="chat-page">
      <div className="row row--nowrap" style={{ alignItems: 'baseline' }}>
        <Link to="/chat" className="muted" aria-label="عودة">→</Link>
        <div className="flex1" style={{ minWidth: 0 }}>
          <h1 className="page-title ellipsis">{channel.name}</h1>
          <div className="chips" style={{ marginTop: 2 }}>
            {channel.committeeIds.map((cid) => {
              const c = byId.get(cid);
              return c ? (
                <span key={cid} {...committeeBadgeProps(c.colorKey)}>
                  {c.name}
                </span>
              ) : null;
            })}
            {channel.type === 'announcements' && <span className="badge badge--info">إعلانات</span>}
          </div>
        </div>
      </div>

      {loadingMsgs && <Loading />}
      <div
        className="chat-msgs"
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {hasMore && visible.length > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={loadOlder} disabled={loadingMore}>
            {loadingMore ? 'جارٍ التحميل…' : 'تحميل رسائل أقدم'}
          </button>
        )}
        {!loadingMsgs && visible.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', padding: 20 }}>
            لا رسائل بعد. {canPost ? 'ابدأ المحادثة!' : ''}
          </p>
        )}
        {visible.map((m) => {
          const mine = m.senderId === user?.uid;
          return (
            <div key={m.id} className={`chat-msg ${mine ? 'chat-msg--mine' : ''} ${m.hidden ? 'chat-msg--hidden' : ''}`}>
              {!mine && (
                <div className="chat-meta">
                  <strong>{m.senderName}</strong>
                  {committeeByUid.get(m.senderId) && <span> · {committeeByUid.get(m.senderId)}</span>}
                </div>
              )}
              <div className="chat-bubble sw">{m.text}</div>
              <div className="chat-meta">
                {m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleString('ar-SY', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                {m.hidden && ' · محجوبة'}
                {isAdmin && (
                  <button className="linklike" onClick={() => toggleHidden(m)}>
                    {m.hidden ? 'إظهار' : 'إخفاء'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {canPost ? (
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            className="input flex1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={channel.type === 'announcements' ? 'اكتب إعلانًا…' : 'اكتب رسالة…'}
            maxLength={2000}
          />
          <button className="btn btn--primary" disabled={sending || !text.trim()}>
            {sending ? '…' : 'إرسال'}
          </button>
        </form>
      ) : (
        <p className="muted small" style={{ textAlign: 'center', padding: 8 }}>
          {channel.status === 'archived' ? 'هذه القناة معطّلة.' : 'للقراءة فقط.'}
        </p>
      )}
    </div>
  );
}
