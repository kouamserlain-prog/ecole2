import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parentApi, studentApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { FiInbox, FiSend, FiEdit3, FiMail, FiRefreshCw } from 'react-icons/fi';
import MessageRecipientSearch from '../messaging/MessageRecipientSearch';
import { flattenMessagingContacts } from '../messaging/flattenMessagingContacts';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'GENERAL', label: 'Général' },
  { value: 'ACADEMIC', label: 'Scolarité / cours' },
  { value: 'ABSENCE', label: 'Absence' },
  { value: 'PAYMENT', label: 'Paiement / frais' },
  { value: 'CONDUCT', label: 'Conduite' },
  { value: 'URGENT', label: 'Urgent' },
];

type Role = 'parent' | 'student';

type Props = {
  role: Role;
  contextStudentId?: string | null;
};

function roleLabel(r: string | undefined) {
  switch (r) {
    case 'ADMIN':
      return 'Administration';
    case 'TEACHER':
      return 'Enseignant';
    case 'EDUCATOR':
      return 'Éducateur';
    case 'STAFF':
      return 'Personnel';
    default:
      return r ?? '—';
  }
}

type ThreadRow = {
  threadKey: string;
  lastAt: string;
  lastPreview: string;
  peerId: string;
  peerName: string;
  peerRole: string;
  unread: number;
};

function ParentThreadedMessaging({ contextStudentId }: { contextStudentId?: string | null }) {
  const { user } = useAuth();
  const myId = user?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<'threads' | 'compose'>('threads');
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [receiverId, setReceiverId] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [childId, setChildId] = useState('');
  const [attachmentLines, setAttachmentLines] = useState('');

  const { data: children } = useQuery({
    queryKey: ['parent-children'],
    queryFn: parentApi.getChildren,
  });

  useEffect(() => {
    if (contextStudentId) setChildId(contextStudentId);
  }, [contextStudentId]);

  const { data: threadsData, isLoading: threadsLoading } = useQuery({
    queryKey: ['parent-messaging-threads'],
    queryFn: () => parentApi.getMessageThreads(),
    refetchInterval: 12_000,
  });

  const { data: contactsData } = useQuery({
    queryKey: ['parent-messaging-contacts'],
    queryFn: () => parentApi.getMessageContacts(),
    staleTime: 60_000,
  });

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['parent-messaging-thread', selectedThreadKey],
    queryFn: () => parentApi.getMessageThread(selectedThreadKey!),
    enabled: Boolean(selectedThreadKey) && tab === 'threads',
    refetchInterval: 10_000,
  });

  const threads: ThreadRow[] = (threadsData as { threads?: ThreadRow[] } | undefined)?.threads ?? [];
  const contacts = contactsData as
    | {
        admins?: { id: string; firstName: string; lastName: string; email: string; role: string }[];
        teachers?: { id: string; firstName: string; lastName: string; email: string; role: string; label: string }[];
        staff?: { id: string; firstName: string; lastName: string; email: string; role: string }[];
        educators?: { id: string; firstName: string; lastName: string; email: string; role: string }[];
      }
    | undefined;

  const recipientUsers = useMemo(() => flattenMessagingContacts(contacts), [contacts]);

  const parseAttachments = () =>
    attachmentLines
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

  const sendMutation = useMutation({
    mutationFn: () =>
      parentApi.sendSchoolMessage({
        subject: subject.trim() || undefined,
        content: content.trim(),
        category,
        ...(childId ? { studentId: childId } : {}),
        ...(receiverId ? { receiverId } : {}),
        ...(receiverId && selectedThreadKey && selectedPeer && receiverId === selectedPeer.peerId
          ? { threadKey: selectedThreadKey }
          : {}),
        attachmentUrls: parseAttachments(),
      }),
    onSuccess: () => {
      toast.success('Message envoyé');
      setSubject('');
      setContent('');
      setAttachmentLines('');
      setTab('threads');
      qc.invalidateQueries({ queryKey: ['parent-messaging-threads'] });
      if (selectedThreadKey) qc.invalidateQueries({ queryKey: ['parent-messaging-thread', selectedThreadKey] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Envoi impossible'),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => parentApi.markMessageAsRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-messaging-threads'] });
      qc.invalidateQueries({ queryKey: ['parent-messaging-thread', selectedThreadKey] });
    },
  });

  const messages = (threadData as { messages?: any[] } | undefined)?.messages ?? [];
  const selectedPeer = threads.find((t) => t.threadKey === selectedThreadKey);

  const startComposeToAdmin = () => {
    const firstAdmin = contacts?.admins?.[0];
    setReceiverId(firstAdmin?.id ?? '');
    setTab('compose');
    setSelectedThreadKey(null);
  };

  const startComposeReply = () => {
    if (!selectedPeer) return;
    setReceiverId(selectedPeer.peerId);
    setTab('compose');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setTab('threads')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'threads'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FiInbox className="w-4 h-4" />
          Conversations
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('compose');
            setReceiverId('');
            setSelectedThreadKey(null);
            setSubject('');
            setContent('');
            setAttachmentLines('');
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'compose'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FiEdit3 className="w-4 h-4" />
          Nouveau message
        </button>
        <Button
          type="button"
          variant="outline"
          className="text-sm ml-auto"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ['parent-messaging-threads'] });
            qc.invalidateQueries({ queryKey: ['parent-messaging-thread', selectedThreadKey] });
          }}
        >
          <FiRefreshCw className="w-4 h-4 mr-1 inline" />
          Actualiser
        </Button>
      </div>

      {tab === 'threads' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,260px)_1fr] gap-4">
          <Card className="p-3 border border-orange-100 max-h-[65vh] flex flex-col">
            <p className="text-xs font-semibold text-gray-700 mb-2">Fils</p>
            <div className="flex-1 overflow-y-auto space-y-1">
              {threadsLoading ? (
                <p className="text-xs text-gray-500">Chargement…</p>
              ) : threads.length === 0 ? (
                <p className="text-xs text-gray-500">Aucun échange pour le moment.</p>
              ) : (
                threads.map((t) => (
                  <button
                    key={t.threadKey}
                    type="button"
                    onClick={() => setSelectedThreadKey(t.threadKey)}
                    className={`w-full text-left rounded-lg px-2 py-2 text-xs border ${
                      selectedThreadKey === t.threadKey
                        ? 'bg-orange-50 border-orange-200'
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium flex justify-between gap-1">
                      <span className="truncate">{t.peerName}</span>
                      {t.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-rose-500 text-white text-[10px] px-1.5 py-0.5 font-bold">
                          {t.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 truncate mt-0.5">{t.lastPreview}</p>
                  </button>
                ))
              )}
            </div>
            <Button type="button" variant="outline" className="mt-2 text-xs" onClick={startComposeToAdmin}>
              Écrire à l’administration
            </Button>
          </Card>
          <Card className="p-4 border border-gray-200 min-h-[320px] flex flex-col">
            {!selectedThreadKey ? (
              <p className="text-sm text-gray-500">Sélectionnez une conversation.</p>
            ) : (
              <>
                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">{selectedPeer?.peerName}</h3>
                  <Button type="button" variant="outline" className="text-xs" onClick={startComposeReply}>
                    Répondre
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {threadLoading ? (
                    <p className="text-sm text-gray-500">Chargement…</p>
                  ) : (
                    messages.map((m: any) => {
                      const mine = myId && m.senderId === myId;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`block w-full text-left rounded-lg px-3 py-2 text-sm border ${
                            mine ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'
                          }`}
                          onClick={() => {
                            if (!m.read && m.receiverId === myId) markRead.mutate(m.id);
                          }}
                        >
                          <p className="text-[10px] text-gray-500">
                            {m.sender?.firstName} {m.sender?.lastName} ·{' '}
                            {format(new Date(m.createdAt), 'd MMM yyyy HH:mm', { locale: fr })}
                          </p>
                          {m.subject && <p className="font-medium text-gray-900 mt-1">{m.subject}</p>}
                          <p className="text-gray-800 mt-1 whitespace-pre-wrap">{m.content}</p>
                          {Array.isArray(m.attachmentUrls) && m.attachmentUrls.length > 0 && (
                            <ul className="mt-2 text-xs text-orange-700 space-y-1">
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
              </>
            )}
          </Card>
        </div>
      )}

      {tab === 'compose' && (
        <Card className="p-6 border border-orange-100 bg-white shadow-sm max-w-2xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Nouveau message</h3>
          <p className="text-sm text-gray-500 mb-4">
            Administration, personnel (bibliothèque, secrétariat…), enseignants ou éducateurs. Laissez « Administration »
            pour le compte admin par défaut.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Destinataire</label>
              <MessageRecipientSearch
                accent="orange"
                allowDefault
                defaultLabel="— Administration (défaut) —"
                users={recipientUsers}
                value={receiverId}
                onChange={setReceiverId}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Concernant un enfant (optionnel)</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
              >
                <option value="">— Message général —</option>
                {(children as any[])?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.user?.firstName} {c.user?.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Objet</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Objet du message"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Message *</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[140px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Votre message…"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pièces jointes (URL, une par ligne)</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono min-h-[64px]"
                value={attachmentLines}
                onChange={(e) => setAttachmentLines(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <Button
              type="button"
              onClick={() => sendMutation.mutate()}
              disabled={!content.trim() || sendMutation.isPending}
            >
              <FiMail className="w-4 h-4 mr-2" />
              Envoyer
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

const SchoolCommunication: React.FC<Props> = ({ role, contextStudentId }) => {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<'inbox' | 'sent' | 'compose'>('inbox');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [attachmentLines, setAttachmentLines] = useState('');

  if (role === 'parent') {
    return <ParentThreadedMessaging contextStudentId={contextStudentId} />;
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['school-messages', role],
    queryFn: () => studentApi.getMessages(),
    refetchInterval: 12_000,
  });

  const received = (data as { received?: any[] } | undefined)?.received ?? [];
  const sent = (data as { sent?: any[] } | undefined)?.sent ?? [];

  const unreadCount = received.filter((m: any) => !m.read).length;

  const markRead = useMutation({
    mutationFn: (id: string) => studentApi.markMessageAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-messages', role] });
    },
  });

  const sendMessage = useMutation({
    mutationFn: () =>
      studentApi.sendSchoolMessage({
        subject: subject.trim() || undefined,
        content: content.trim(),
        category,
        attachmentUrls: attachmentLines
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('Message envoyé à l’administration');
      setSubject('');
      setContent('');
      setAttachmentLines('');
      queryClient.invalidateQueries({ queryKey: ['school-messages', role] });
      setSection('sent');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Envoi impossible'),
  });

  const openMessage = (m: any) => {
    if (!m.read) {
      markRead.mutate(m.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSection('inbox')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            section === 'inbox'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FiInbox className="w-4 h-4" />
          Reçus
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs">{unreadCount}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSection('sent')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            section === 'sent'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FiSend className="w-4 h-4" />
          Envoyés
        </button>
        <button
          type="button"
          onClick={() => setSection('compose')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            section === 'compose'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FiEdit3 className="w-4 h-4" />
          Nouveau message
        </button>
        <Button type="button" variant="outline" className="ml-auto text-sm" onClick={() => refetch()}>
          Actualiser
        </Button>
      </div>

      {section === 'compose' && (
        <Card className="p-6 border border-orange-100 bg-white shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Écrire à l’école</h3>
          <p className="text-sm text-gray-500 mb-4">
            Votre message est adressé à l’administration. Vous recevrez une réponse dans la boîte « Reçus ».
          </p>
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Objet</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Objet du message"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Message *</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[140px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Votre message…"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pièces jointes (URL, une par ligne)</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono min-h-[64px]"
                value={attachmentLines}
                onChange={(e) => setAttachmentLines(e.target.value)}
              />
            </div>
            <Button
              type="button"
              onClick={() => sendMessage.mutate()}
              disabled={!content.trim() || sendMessage.isPending}
            >
              <FiMail className="w-4 h-4 mr-2" />
              Envoyer
            </Button>
          </div>
        </Card>
      )}

      {section === 'inbox' && (
        <Card className="overflow-hidden border border-gray-200">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">Chargement…</div>
          ) : received.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Aucun message reçu.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {received.map((m: any) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors ${
                      !m.read ? 'bg-orange-50/50' : ''
                    }`}
                    onClick={() => openMessage(m)}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-gray-900">
                        {m.sender?.firstName} {m.sender?.lastName}
                        <span className="text-xs font-normal text-gray-500 ml-2">
                          ({roleLabel(m.sender?.role)})
                        </span>
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {format(new Date(m.createdAt), 'd MMM yyyy HH:mm', { locale: fr })}
                      </span>
                    </div>
                    {m.subject && <p className="text-sm font-medium text-gray-800 mt-1">{m.subject}</p>}
                    <p className="text-sm text-gray-600 mt-1 line-clamp-3 whitespace-pre-wrap">{m.content}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {section === 'sent' && (
        <Card className="overflow-hidden border border-gray-200">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">Chargement…</div>
          ) : sent.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Aucun message envoyé.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sent.map((m: any) => (
                <li key={m.id} className="px-4 py-4">
                  <div className="flex justify-between gap-2">
                    <span className="text-sm text-gray-500">
                      À : {m.receiver?.firstName} {m.receiver?.lastName} ({roleLabel(m.receiver?.role)})
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(m.createdAt), 'd MMM yyyy HH:mm', { locale: fr })}
                    </span>
                  </div>
                  {m.subject && <p className="text-sm font-medium text-gray-900 mt-1">{m.subject}</p>}
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{m.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
};

export default SchoolCommunication;
