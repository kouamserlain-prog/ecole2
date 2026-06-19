export const DEFAULT_DIRECTOR_NAME = "N'GUESSAN AMELA APOLLINE";
export const DEFAULT_DIRECTOR_ROLE = 'Directrice des Études';
export const DEFAULT_DIRECTOR_OCCASION = 'À l’occasion de la rentrée scolaire';
export const DEFAULT_DIRECTOR_MESSAGE_TITLE = 'Mot de la Directrice des Études';
export const DEFAULT_DIRECTOR_CLOSING = 'Bonne rentrée scolaire à toutes et à tous.';
export const DEFAULT_DIRECTOR_FOOTER = 'Collège Privé Tranlefet de Bouaké — Bouaké, Côte d\'Ivoire';

export const DEFAULT_DIRECTOR_MESSAGE_PARAGRAPHS = [
  'Chers parents d’élèves, Mesdames et Messieurs les enseignants, Chers élèves, Honorables membres du personnel éducatif et administratif,',
  'À l’aube de cette nouvelle année scolaire, la Direction du Collège Privé Tranlefet de Bouaké adresse à l’ensemble de la communauté éducative ses salutations les plus chaleureuses ainsi que ses vœux de santé, de paix et de réussite.',
  'La rentrée scolaire constitue un moment important dans la vie de notre établissement. Elle marque le début d’un nouveau parcours fait d’apprentissage, d’efforts, de discipline et d’engagement collectif au service de l’excellence.',
  'La Direction rappelle aux parents d’élèves que l’école demeure le socle fondamental de la formation de l’enfant et de la construction de son avenir. Offrir une éducation de qualité à son enfant, c’est lui donner les moyens de devenir un citoyen responsable, compétent et utile à la société. C’est pourquoi nous invitons chaque parent à accompagner efficacement le suivi scolaire et moral de son enfant tout au long de l’année.',
  'Aux enseignants et à l’ensemble du personnel éducatif, la Direction renouvelle sa confiance et son attachement aux valeurs de rigueur, de professionnalisme, de ponctualité et de responsabilité qui fondent la noblesse de notre mission éducative. L’encadrement pédagogique de qualité demeure un pilier essentiel pour l’amélioration constante des résultats scolaires de nos apprenants.',
  'Aux élèves, nous adressons un appel à la discipline, au respect des règles de l’établissement, à l’assiduité au travail et à la persévérance. Le succès scolaire est le fruit du sérieux, du courage et de l’engagement personnel.',
  'La Direction reste convaincue que les excellents résultats scolaires auxquels aspire notre établissement ne pourront être atteints que grâce à l’union des efforts de tous : parents, enseignants, élèves et personnel administratif.',
  'Ensemble, poursuivons notre engagement pour une école d’excellence, de discipline et de réussite.',
];

export type DirectorMessageBranding = {
  studiesDirectorName?: string | null;
  studiesDirectorOccasionBadge?: string | null;
  studiesDirectorMessageTitle?: string | null;
  studiesDirectorMessage?: string | null;
  studiesDirectorClosing?: string | null;
  studiesDirectorFooterLine?: string | null;
  schoolDisplayName?: string | null;
};

export function directorMessageParagraphsFromBody(body: string | null | undefined): string[] {
  if (!body?.trim()) return DEFAULT_DIRECTOR_MESSAGE_PARAGRAPHS;
  const parts = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts : DEFAULT_DIRECTOR_MESSAGE_PARAGRAPHS;
}

export function directorMessageBodyFromParagraphs(paragraphs: string[]): string {
  return paragraphs.join('\n\n');
}

export function resolveDirectorMessageContent(branding: DirectorMessageBranding) {
  const schoolName =
    branding.schoolDisplayName?.trim() || 'Collège Privé Tranlefet de Bouaké';

  return {
    name: branding.studiesDirectorName?.trim() || DEFAULT_DIRECTOR_NAME,
    role: DEFAULT_DIRECTOR_ROLE,
    occasionBadge: branding.studiesDirectorOccasionBadge?.trim() || DEFAULT_DIRECTOR_OCCASION,
    messageTitle: branding.studiesDirectorMessageTitle?.trim() || DEFAULT_DIRECTOR_MESSAGE_TITLE,
    paragraphs: directorMessageParagraphsFromBody(branding.studiesDirectorMessage),
    closing: branding.studiesDirectorClosing?.trim() || DEFAULT_DIRECTOR_CLOSING,
    footerLine:
      branding.studiesDirectorFooterLine?.trim() ||
      `${schoolName} — Bouaké, Côte d'Ivoire`,
    schoolName,
  };
}
