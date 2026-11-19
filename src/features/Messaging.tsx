/**
 * Role-scoped messaging: students message only their own teachers; parents
 * message only the teachers of their own children; teachers message their
 * students and those students' parents. All messages go through the
 * messageApi which writes to the audit log for Admin moderation.
 */
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { messageApi, usersApi, classApi } from '../services/api';
import { Avatar, Button, Card, Input, Textarea } from '../components/ui';
import type { User } from '../types';

export function Messaging({
  me, allowedPartners, title,
}: {
  me: User;
  allowedPartners: (partner: User) => boolean;
  title: string;
}) {
  const { t } = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [version, setVersion] = useState(0);

  const conversations = useMemo(() => messageApi.forUser(me.id, (pid) => {
    const u = usersApi.byId(pid);
    return !!u && allowedPartners(u);
  }), [me.id, version]);

  useEffect(() => {
    if (!activeId && conversations.length) setActiveId(conversations[0].partner.id);
    if (activeId && !conversations.some((c) => c.partner.id === activeId)) setActiveId(conversations[0]?.partner.id ?? null);
  }, [conversations, activeId]);

  const active = conversations.find((c) => c.partner.id === activeId);
  const messages = active?.messages ?? [];

  const send = () => {
    if (!draft.trim() || !activeId) return;
    messageApi.send(me.id, activeId, draft.trim());
    setDraft('');
    setVersion((v) => v + 1);
  };

  useEffect(() => {
    if (activeId) messageApi.markRead(me.id, activeId);
  }, [activeId, messages.length, me.id]);

  return (
    <Card title={title}>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        {/* conversation list */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700">
            {t('messaging')}
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {conversations.length === 0 && <p className="p-4 text-sm text-slate-400">{t('noData')}</p>}
            {conversations.map((c) => (
              <button key={c.partner.id} onClick={() => setActiveId(c.partner.id)}
                className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-start transition-colors last:border-0 ${
                  activeId === c.partner.id ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                <Avatar name={c.partner.name} color={c.partner.avatarColor} size={34} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{c.partner.name}</p>
                  <p className="truncate text-xs text-slate-400">{t(`role_${c.partner.role}`)} · {c.messages.filter((m) => m.fromId === c.partner.id && !m.read).length} unread</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* thread */}
        <div className="flex min-h-[400px] flex-col rounded-xl border border-slate-200 dark:border-slate-700">
          {active ? (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <Avatar name={active.partner.name} color={active.partner.avatarColor} size={36} />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{active.partner.name}</p>
                  <p className="text-xs capitalize text-slate-400">{t(`role_${active.partner.role}`)}</p>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900/40" style={{ maxHeight: 420 }}>
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.fromId === me.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                      m.fromId === me.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-100'}`}>
                      {m.content}
                      <p className={`mt-0.5 text-[10px] ${m.fromId === me.id ? 'text-brand-100' : 'text-slate-400'}`}>
                        {new Date(m.at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && <p className="text-center text-sm text-slate-400">{t('messagePlaceholder')}</p>}
              </div>
              <div className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder={t('messagePlaceholder')}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <Button onClick={send} disabled={!draft.trim()}>{t('send')}</Button>
              </div>
            </>
          ) : (
            <p className="m-auto text-sm text-slate-400">Select a conversation</p>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Contact rules for each role — the heart of the data-isolation policy. */
export function contactsFor(me: User): (partner: User) => boolean {
  return (partner) => {
    if (partner.id === me.id) return false;
    if (me.role === 'admin') return false; // admins moderate; they don't message
    if (me.role === 'student') {
      // own teachers only
      const myClasses = classApi.list().filter((c) => me.studentClassIds?.includes(c.id));
      return partner.role === 'teacher' && myClasses.some((c) => c.teacherId === partner.id);
    }
    if (me.role === 'parent') {
      // only teachers of my own linked children
      const myChildren = me.children ?? [];
      const myClasses = classApi.list().filter((c) => c.studentIds.some((sid) => myChildren.includes(sid)));
      return partner.role === 'teacher' && myClasses.some((c) => c.teacherId === partner.id);
    }
    if (me.role === 'teacher') {
      // my students and their parents
      const myClasses = classApi.list().filter((c) => me.classIds?.includes(c.id));
      const myStudentIds = myClasses.flatMap((c) => c.studentIds);
      if (partner.role === 'student') return myStudentIds.includes(partner.id);
      if (partner.role === 'parent') return (partner.children ?? []).some((cid) => myStudentIds.includes(cid));
      return false;
    }
    return false;
  };
}
