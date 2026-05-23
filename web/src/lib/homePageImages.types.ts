export const HOME_PAGE_IMAGE_SLOTS = [
  'homeHeroPlatform',
  'homePillarPedagogy',
  'homePillarPortals',
  'homePillarSecurity',
  'homePillarAdministration',
  'homeRoleAdmin',
  'homeRoleTeacher',
  'homeRoleStudent',
  'homeRoleParent',
  'homeSplitCampus',
] as const;

export type HomePageImageSlot = (typeof HOME_PAGE_IMAGE_SLOTS)[number];

export type HomePageImagesRecord = Partial<Record<HomePageImageSlot, string | null>>;

export type HomePageImageDefinition = {
  slot: HomePageImageSlot;
  label: string;
  hint: string;
  defaultPath: string;
  group: 'Hero' | 'Piliers' | 'Communauté' | 'Établissement';
};

export const HOME_PAGE_IMAGE_DEFINITIONS: HomePageImageDefinition[] = [
  {
    slot: 'homeHeroPlatform',
    label: 'Bannière principale (hero)',
    hint: 'Grande image à droite du titre d’accueil — format paysage recommandé.',
    defaultPath: '/home/hero-platform.jpg',
    group: 'Hero',
  },
  {
    slot: 'homePillarPedagogy',
    label: 'Pilier — Formation de qualité',
    hint: 'Carte « Notre projet éducatif », 1ère grande tuile.',
    defaultPath: '/home/pillar-pedagogy.jpg',
    group: 'Piliers',
  },
  {
    slot: 'homePillarPortals',
    label: 'Pilier — Innovation pédagogique',
    hint: 'Carte « Innovation pédagogique ».',
    defaultPath: '/home/pillar-portals.jpg',
    group: 'Piliers',
  },
  {
    slot: 'homePillarSecurity',
    label: 'Pilier — Vie scolaire',
    hint: 'Carte « Vie scolaire ».',
    defaultPath: '/home/pillar-security.jpg',
    group: 'Piliers',
  },
  {
    slot: 'homePillarAdministration',
    label: 'Pilier — Administration & familles',
    hint: 'Carte « Administration & familles ».',
    defaultPath: '/home/pillar-administration.jpg',
    group: 'Piliers',
  },
  {
    slot: 'homeRoleAdmin',
    label: 'Communauté — Direction',
    hint: 'Carte rôle « Direction ».',
    defaultPath: '/home/role-admin.jpg',
    group: 'Communauté',
  },
  {
    slot: 'homeRoleTeacher',
    label: 'Communauté — Enseignant',
    hint: 'Carte rôle « Enseignant ».',
    defaultPath: '/home/role-teacher.jpg',
    group: 'Communauté',
  },
  {
    slot: 'homeRoleStudent',
    label: 'Communauté — Élève',
    hint: 'Carte rôle « Élève ».',
    defaultPath: '/home/role-student.jpg',
    group: 'Communauté',
  },
  {
    slot: 'homeRoleParent',
    label: 'Communauté — Parent',
    hint: 'Carte rôle « Parent ».',
    defaultPath: '/home/role-parent.jpg',
    group: 'Communauté',
  },
  {
    slot: 'homeSplitCampus',
    label: 'Campus / bâtiment',
    hint: 'Grande image de la section « Un collège privé exigeant à Bouaké ».',
    defaultPath: '/home/split-campus.jpg',
    group: 'Établissement',
  },
];
