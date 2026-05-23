import type { Message, MessageCategory, Role } from '@prisma/client';
import prisma from './prisma';
import { sendWebPushToUsers } from './push-send.util';

/** Rôles pouvant envoyer / recevoir des messages sur la plateforme. */
export const PLATFORM_MESSAGING_ROLES = new Set<Role>([
  'SUPER_ADMIN',
  'ADMIN',
  'TEACHER',
  'STUDENT',
  'PARENT',
  'EDUCATOR',
  'STAFF',
]);

export function isPlatformMessagingRole(role: string): role is Role {
  return PLATFORM_MESSAGING_ROLES.has(role as Role);
}

/** Clé stable pour une conversation 1:1 entre deux utilisateurs */
export function makeDmThreadKey(userIdA: string, userIdB: string): string {
  return `dm_${[userIdA, userIdB].sort().join('__')}`;
}

export function effectiveThreadKey(m: {
  threadKey: string | null;
  senderId: string;
  receiverId: string;
}): string {
  if (m.threadKey && m.threadKey.trim().length > 0) {
    return m.threadKey.trim();
  }
  return makeDmThreadKey(m.senderId, m.receiverId);
}

function portalPathForRole(role: Role): string {
  switch (role) {
    case 'PARENT':
      return '/parent?tab=communication';
    case 'STUDENT':
      return '/student';
    case 'TEACHER':
      return '/teacher?tab=messaging';
    case 'EDUCATOR':
      return '/educator?tab=messaging';
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return '/admin?tab=communication';
    case 'STAFF':
      return '/staff?tab=communication_mgmt';
    default:
      return '/';
  }
}

export async function notifyUserNewMessage(params: {
  receiverUserId: string;
  receiverRole: Role;
  senderDisplayName: string;
  subject: string | null;
  contentSnippet: string;
}): Promise<void> {
  const title = params.subject?.trim()
    ? params.subject.trim().slice(0, 120)
    : `Message de ${params.senderDisplayName}`.slice(0, 120);
  const body = params.contentSnippet.trim().slice(0, 280);
  const url = portalPathForRole(params.receiverRole);
  await prisma.notification.create({
    data: {
      userId: params.receiverUserId,
      type: 'message',
      title,
      content: body,
      link: url,
    },
  });
  await sendWebPushToUsers([params.receiverUserId], { title, body, url });
}

export async function createInternalPlatformMessage(params: {
  senderId: string;
  receiverId: string;
  subject?: string | null;
  content: string;
  category?: MessageCategory;
  threadKey?: string | null;
  attachmentUrls?: string[];
}): Promise<Message> {
  const threadKey =
    params.threadKey && params.threadKey.trim().length > 0
      ? params.threadKey.trim()
      : makeDmThreadKey(params.senderId, params.receiverId);
  const attachments = Array.isArray(params.attachmentUrls)
    ? params.attachmentUrls.filter((u) => typeof u === 'string' && u.trim().length > 0).map((u) => u.trim())
    : [];

  const [receiver, sender] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.receiverId },
      select: { id: true, role: true, isActive: true },
    }),
    prisma.user.findUnique({
      where: { id: params.senderId },
      select: { firstName: true, lastName: true },
    }),
  ]);

  if (!receiver || !receiver.isActive) {
    throw new Error('Destinataire introuvable ou inactif');
  }

  const message = await prisma.message.create({
    data: {
      senderId: params.senderId,
      receiverId: params.receiverId,
      subject: params.subject && String(params.subject).trim() ? String(params.subject).trim() : null,
      content: params.content.trim(),
      category: params.category ?? 'GENERAL',
      channels: ['PLATFORM'],
      threadKey,
      attachmentUrls: attachments,
    },
  });

  const senderName =
    `${sender?.firstName ?? ''} ${sender?.lastName ?? ''}`.trim() || 'Un utilisateur';
  await notifyUserNewMessage({
    receiverUserId: receiver.id,
    receiverRole: receiver.role,
    senderDisplayName: senderName,
    subject: message.subject,
    contentSnippet: message.content,
  });

  return message;
}

export async function teacherTeachesClass(teacherUserId: string, classId: string): Promise<boolean> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId: teacherUserId },
    select: { id: true },
  });
  if (!teacher) return false;
  const course = await prisma.course.findFirst({
    where: { teacherId: teacher.id, classId },
    select: { id: true },
  });
  return Boolean(course);
}

export async function parentLinkedToTeacherUser(
  parentUserId: string,
  teacherUserId: string
): Promise<boolean> {
  const row = await prisma.course.findFirst({
    where: {
      teacher: { userId: teacherUserId },
      class: {
        students: {
          some: {
            parents: { some: { parent: { userId: parentUserId } } },
          },
        },
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function teacherLinkedToParentUser(
  teacherUserId: string,
  parentUserId: string
): Promise<boolean> {
  return parentLinkedToTeacherUser(parentUserId, teacherUserId);
}
