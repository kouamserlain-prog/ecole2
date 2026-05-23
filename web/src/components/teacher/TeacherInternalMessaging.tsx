'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { teacherApi } from '../../services/api/teacher.api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { FiRefreshCw, FiSend, FiUsers } from 'react-icons/fi';

type ThreadRow = {
  threadKey: string;
  lastAt: string;
  lastPreview: string;
  peerId: string;
  peerName: string;
  peerRole: string;
  unread: number;
};

const TeacherInternalMessaging: React.FC = () => {
  const { user } = useAuth();
  const myId = user?.id;
  const qc = useQueryClient();
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'compose'>('idle');
  const [receiverId, setReceiverId] = useState('');
  const [broadcastClassId, setBroadcastClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [attachmentLines, setAttachmentLines] = useState('');

  const { data: threadsData, isLoading: threadsLoading } = useQuery({
    queryKey: ['teacher-messaging-threads'],
    queryFn: () => teacherApi.getMessagingThreads(),
    refetchInterval: 12_000,
  });

  const { data: contactsData } = useQuery({
    queryKey: ['teacher-messaging-contacts'],
    queryFn: () => teacherApi.getMessagingContacts(),
    staleTime: 60_000,
  });

  const { data: courses } = useQuery({
    queryKey: ['teacher-courses'],
    queryFn: () => teacherApi.getCourses(),
  });

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['teacher-messaging-thread', selectedThreadKey],
    queryFn: () => teacherApi.getMessagingThread(selectedThreadKey!),
    enabled: Boolean(selectedThreadKey) && mode === 'idle',
    refetchInterval: 10_000,
  });

  const threads: ThreadRow[] = (threadsData as { threads?: ThreadRow[] } | undefined)?.threads ?? [];

  const classOptions = useMemo(() => {
    const list = (courses as { class?: { id: string; name: string; level: string } }[] | undefined) ?? [];
    const map = new Map<string, string>();
    for (const c of list) {
      if (c.class?.id) {
        map.set(c.class.id, `${c.class.name} — ${c.class.level}`);
      }
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [courses]);

  const contacts = contactsData as
    | {
        admins?: { id: string; firstName: string; lastName: string; email: string; role: string }[];
        teachers?: { id: string; firstName: string; lastName: string; email: string; role: string }[];
        staff?: { id: string; firstName: string; lastName: string; email: string; role: string }[];
        educators?: { id: string; firstName: string; lastName: string; email: string; role: string }[];
        parents?: { id: string; firstName: string; lastName: string; email: string; role: string; _label?: string }[];
      }
    | undefined;

  const parseAttachments = () =>
    attachmentLines
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

  const sendMutation = useMutation({
    mutationFn: (payload: {
      receiverId?: string;
      broadcastClassId?: string;
      subject?: string;
      content: string;
      threadKey?: string;
      attachmentUrls?: string[];
    }) => teacherApi.sendMessagingMessage(payload),
    onSuccess: (_data, variables) => {
      toast.success(variables.broadcastClassId ? 'Message groupé envoyé' : 'Message envoyé');
      setSubject('');
      setContent('');
      setAttachmentLines('');
      setBroadcastClassId('');
      setReceiverId('');
      setMode('idle');
      qc.invalidateQueries({ queryKey: ['teacher-messaging-threads'] });
      if (variables.threadKey) {
        qc.invalidateQueries({ queryKey: ['teacher-messaging-thread', variables.threadKey] });
      }
      if (selectedThreadKey) {
        qc.invalidateQueries({ queryKey: ['teacher-messaging-thread', selectedThreadKey] });
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Envoi impossible'),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => teacherApi.markMessagingMessageRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-messaging-threads'] });
      qc.invalidateQueries({ queryKey: ['teacher-messaging-thread', selectedThreadKey] });
    },
  });

  const messages = (threadData as { messages?: any[] } | undefined)?.messages ?? [];

  const selectedPeer = threads.find((t) => t.threadKey === selectedThreadKey);

  const openComposeNew = () => {
    setMode('compose');
    setSelectedThreadKey(null);
    setReceiverId('');
    setBroadcastClassId('');
    setSubject('');
    setContent('');
    setAttachmentLines('');
  };

  const openReplyInThread = () => {
    if (!selectedThreadKey || !selectedPeer) return;
    setMode('compose');
    setReceiverId(selectedPeer.peerId);
    setBroadcastClassId('');
    setSubject('');
    setContent('');
    setAttachmentLines('');
  };

  const submitCompose = () => {
    if (!content.trim()) return;
    if (broadcastClassId) {
      sendMutation.mutate({
        broadcastClassId,
        subject: subject.trim() || undefined,
        content: content.trim(),
        attachmentUrls: parseAttachments(),
      });
      return;
    }
    if (!receiverId) {
      toast.error('Choisissez un destinataire');
      return;
    }
    const threadKey =
      selectedThreadKey && selectedPeer && receiverId === selectedPeer.peerId ? selectedThreadKey : undefined;
    sendMutation.mutate({
      receiverId,
      subject: subject.trim() || undefined,
      content: content.trim(),
      threadKey,
      attachmentUrls: parseAttachments(),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,280px)_1fr] gap-4">
      <Card className="p-3 border border-emerald-100 shadow-sm flex flex-col min-h-[420px] max-h-[70vh]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-stone-900">Conversations</h3>
          <button
            type="button"
            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100"
            title="Actualiser"
            aria-label="Actualiser la liste"
            onClick={() => qc.invalidateQueries({ queryKey: ['teacher-messaging-threads'] })}
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
        <Button type="button" className="mb-2 text-sm" variant="outline" onClick={openComposeNew}>
          Nouveau message
        </Button>
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {threadsLoading ? (
            <p className="text-xs text-stone-500 p-2">Chargement…</p>
          ) : threads.length === 0 ? (
            <p className="text-xs text-stone-500 p-2">Aucune conversation.</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.threadKey}
                type="button"
                onClick={() => {
                  setSelectedThreadKey(t.threadKey);
                  setMode('idle');
                }}
                className={`w-full text-left rounded-xl px-3 py-2 text-xs transition-colors ${
                  selectedThreadKey === t.threadKey && mode === 'idle'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-800'
                }`}
              >
                <div className="font-medium flex justify-between gap-1">
                  <span className="truncate">{t.peerName}</span>
                  {t.unread > 0 && (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        selectedThreadKey === t.threadKey && mode === 'idle'
                          ? 'bg-white/25'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {t.unread}
                    </span>
                  )}
                </div>
                <p className="opacity-80 truncate mt-0.5">{t.lastPreview}</p>
                <p className="opacity-70 text-[10px] mt-0.5">
                  {format(new Date(t.lastAt), 'd MMM yyyy HH:mm', { locale: fr })}
                </p>
              </button>
            ))
          )}
        </div>
      </Card>

      <Card className="p-4 border border-stone-200 shadow-sm min-h-[420px] flex flex-col">
        {mode === 'compose' ? (
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-stone-900">Message</h3>
              <Button type="button" variant="outline" className="text-xs" onClick={() => setMode('idle')}>
                Fermer
              </Button>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Diffusion parents (classe)</label>
              <select
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
                value={broadcastClassId}
                onChange={(e) => {
                  setBroadcastClassId(e.target.value);
                  if (e.target.value) setReceiverId('');
                }}
              >
                <option value="">— Message individuel —</option>
                {classOptions.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.label}
                  </option>
                ))}
              </select>
            </div>
            {!broadcastClassId && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Destinataire</label>
                <select
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                >
                  <option value="">— Choisir —</option>
                  <optgroup label="Administration">
                    {(contacts?.admins ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Enseignants">
                    {(contacts?.teachers ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Parents">
                    {(contacts?.parents ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                        {u._label ? ` — ${u._label}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Personnel">
                    {(contacts?.staff ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Éducateurs">
                    {(contacts?.educators ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Objet</label>
              <input
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Message *</label>
              <textarea
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm min-h-[120px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Pièces jointes (URL, une par ligne)
              </label>
              <textarea
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-xs font-mono min-h-[64px]"
                value={attachmentLines}
                onChange={(e) => setAttachmentLines(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <Button
              type="button"
              onClick={submitCompose}
              disabled={
                sendMutation.isPending || !content.trim() || (!broadcastClassId && !receiverId)
              }
            >
              <FiSend className="w-4 h-4 mr-2" />
              {broadcastClassId ? (
                <>
                  <FiUsers className="w-4 h-4 mr-1 inline" />
                  Envoyer à la classe
                </>
              ) : (
                'Envoyer'
              )}
            </Button>
          </div>
        ) : selectedThreadKey ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-2">
              <h3 className="text-base font-semibold text-stone-900 truncate">
                {selectedPeer?.peerName ?? 'Discussion'}
              </h3>
              <Button type="button" variant="outline" className="text-xs shrink-0" onClick={openReplyInThread}>
                Répondre
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
              {threadLoading ? (
                <p className="text-sm text-stone-500">Chargement…</p>
              ) : (
                messages.map((m: any) => {
                  const mine = myId && m.senderId === myId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`block w-full text-left rounded-xl px-3 py-2 text-sm border transition-colors ${
                        mine
                          ? 'bg-emerald-50 border-emerald-100 ml-auto max-w-[92%]'
                          : 'bg-stone-50 border-stone-100 max-w-[92%]'
                      }`}
                      onClick={() => {
                        if (!m.read && m.receiverId === myId) markRead.mutate(m.id);
                      }}
                    >
                      <p className="text-[10px] text-stone-500 mb-1">
                        {m.sender?.firstName} {m.sender?.lastName} ·{' '}
                        {format(new Date(m.createdAt), 'd MMM yyyy HH:mm', { locale: fr })}
                      </p>
                      {m.subject && <p className="font-medium text-stone-900 mb-1">{m.subject}</p>}
                      <p className="whitespace-pre-wrap text-stone-800">{m.content}</p>
                      {Array.isArray(m.attachmentUrls) && m.attachmentUrls.length > 0 && (
                        <ul className="mt-2 text-xs text-emerald-700 space-y-1">
                          {m.attachmentUrls.map((url: string) => (
                            <li key={url}>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="underline break-all">
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-center text-stone-500 py-12">
            <p className="text-sm">Sélectionnez une conversation ou créez un nouveau message.</p>
            <p className="text-xs mt-2 max-w-md">
              Messagerie interne : administration, collègues, familles, personnel et éducateurs, ou diffusion groupée aux
              parents d’une de vos
              classes. Les notifications et le push web vous alertent en temps quasi réel (actualisation automatique).
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TeacherInternalMessaging;
