/**
 * Restaure le catalogue de la bibliothèque physique Tranlefet.
 * Usage: npx tsx scripts/restore-tranlefet-library.ts [--confirm]
 */
import dotenv from 'dotenv';
import prisma from '../src/utils/prisma';
import { ensureDefaultSchool } from '../src/utils/ensure-default-school.util';
import { brandingIdForSchool } from '../src/utils/school-context.util';
import { getAppBrandingDelegate } from '../src/utils/app-branding-prisma.util';

dotenv.config();

type BookSeed = {
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publicationYear?: number;
  category: string;
  copiesTotal: number;
  copiesAvailable: number;
  shelfLocation: string;
  description?: string;
};

const LIBRARY_CATALOG: BookSeed[] = [
  {
    title: 'Le Petit Prince',
    author: 'Antoine de Saint-Exupéry',
    isbn: '978-2-07-036822-8',
    publisher: 'Gallimard',
    publicationYear: 1946,
    category: 'Roman jeunesse',
    copiesTotal: 8,
    copiesAvailable: 6,
    shelfLocation: 'A-01',
  },
  {
    title: 'Les Misérables (abrégé jeunesse)',
    author: 'Victor Hugo',
    isbn: '978-2-01-016810-8',
    publisher: 'Hachette',
    category: 'Classiques',
    copiesTotal: 5,
    copiesAvailable: 4,
    shelfLocation: 'A-02',
  },
  {
    title: 'Une si longue lettre',
    author: 'Mariama Bâ',
    publisher: 'NEA',
    publicationYear: 1980,
    category: 'Littérature africaine',
    copiesTotal: 6,
    copiesAvailable: 5,
    shelfLocation: 'A-03',
  },
  {
    title: 'L’Enfant noir',
    author: 'Camara Laye',
    category: 'Littérature africaine',
    copiesTotal: 4,
    copiesAvailable: 3,
    shelfLocation: 'A-04',
  },
  {
    title: 'De la Terre à la Lune',
    author: 'Jules Verne',
    category: 'Science-fiction',
    copiesTotal: 4,
    copiesAvailable: 4,
    shelfLocation: 'A-05',
  },
  {
    title: 'Mathématiques — Manuel 6ème',
    author: 'Collectif CIAM',
    category: 'Manuel scolaire',
    copiesTotal: 25,
    copiesAvailable: 18,
    shelfLocation: 'M-01',
    description: 'Manuel officiel mathématiques collège',
  },
  {
    title: 'Français — Manuel 6ème',
    author: 'Collectif Hatier',
    category: 'Manuel scolaire',
    copiesTotal: 25,
    copiesAvailable: 20,
    shelfLocation: 'F-01',
  },
  {
    title: 'Français — Manuel 5ème',
    author: 'Collectif Hatier',
    category: 'Manuel scolaire',
    copiesTotal: 22,
    copiesAvailable: 17,
    shelfLocation: 'F-02',
  },
  {
    title: 'Histoire-Géographie — Manuel 4ème',
    author: 'Collectif Belin',
    category: 'Manuel scolaire',
    copiesTotal: 20,
    copiesAvailable: 15,
    shelfLocation: 'H-01',
  },
  {
    title: 'SVT — Manuel 3ème',
    author: 'Collectif Nathan',
    category: 'Manuel scolaire',
    copiesTotal: 18,
    copiesAvailable: 14,
    shelfLocation: 'S-01',
  },
  {
    title: 'Physique-Chimie — Manuel 3ème',
    author: 'Collectif Bordas',
    category: 'Manuel scolaire',
    copiesTotal: 18,
    copiesAvailable: 13,
    shelfLocation: 'P-01',
  },
  {
    title: 'Atlas géographique Afrique',
    author: 'IGN / Jeunesse',
    category: 'Référence',
    copiesTotal: 6,
    copiesAvailable: 5,
    shelfLocation: 'R-01',
  },
  {
    title: 'Dictionnaire Larousse junior',
    author: 'Larousse',
    category: 'Référence',
    copiesTotal: 4,
    copiesAvailable: 2,
    shelfLocation: 'R-02',
  },
  {
    title: 'Grammaire progressive du français — Niveau intermédiaire',
    author: 'Maïa Grégoire',
    category: 'Grammaire',
    copiesTotal: 5,
    copiesAvailable: 4,
    shelfLocation: 'F-10',
  },
  {
    title: 'Anglais — Workbook 4ème',
    author: 'Collectif',
    category: 'Langues vivantes',
    copiesTotal: 15,
    copiesAvailable: 12,
    shelfLocation: 'L-01',
  },
  {
    title: 'Espagnol — Cahier d’activités 3ème',
    author: 'Collectif',
    category: 'Langues vivantes',
    copiesTotal: 12,
    copiesAvailable: 10,
    shelfLocation: 'L-02',
  },
  {
    title: 'Tintin au Congo',
    author: 'Hergé',
    category: 'Bande dessinée',
    copiesTotal: 3,
    copiesAvailable: 2,
    shelfLocation: 'B-01',
  },
  {
    title: 'Le monde selon Garp',
    author: 'John Irving',
    category: 'Roman',
    copiesTotal: 2,
    copiesAvailable: 2,
    shelfLocation: 'A-10',
  },
  {
    title: 'Contes africains',
    author: 'Collectif',
    category: 'Contes',
    copiesTotal: 5,
    copiesAvailable: 5,
    shelfLocation: 'A-11',
  },
  {
    title: 'Encyclopédie junior sciences',
    author: 'Dorling Kindersley',
    category: 'Référence',
    copiesTotal: 3,
    copiesAvailable: 3,
    shelfLocation: 'R-03',
  },
  {
    title: 'Préparation au BEPC — Annales',
    author: 'Collectif',
    category: 'Examens',
    copiesTotal: 10,
    copiesAvailable: 8,
    shelfLocation: 'E-01',
    description: 'Annales et sujets type BEPC',
  },
  {
    title: 'Méthodologie — Rédiger une dissertation',
    author: 'Collectif Nathan',
    category: 'Méthodologie',
    copiesTotal: 6,
    copiesAvailable: 5,
    shelfLocation: 'M-10',
  },
  {
    title: 'Éducation civique et morale — Collège',
    author: 'Collectif',
    category: 'EDHC',
    copiesTotal: 8,
    copiesAvailable: 7,
    shelfLocation: 'C-01',
  },
];

async function ensureBrandingSchoolCode(schoolId: string): Promise<void> {
  const delegate = getAppBrandingDelegate();
  if (!delegate) return;
  const brandingId = await brandingIdForSchool(schoolId);
  await delegate.upsert({
    where: { id: brandingId },
    create: {
      id: brandingId,
      schoolId,
      schoolCode: '253798',
      schoolDisplayName: 'COLLEGE PRIVE TRANLEFET DE BOUAKÉ',
      appTitle: 'CPTB',
    },
    update: { schoolCode: '253798' },
  });
}

async function main() {
  const confirmed = process.argv.includes('--confirm');
  if (!confirmed) {
    console.log(`Aperçu — ${LIBRARY_CATALOG.length} ouvrages à importer.`);
    console.log('Relancez avec --confirm pour appliquer.');
    LIBRARY_CATALOG.slice(0, 5).forEach((b) => console.log(`  · ${b.title} — ${b.author}`));
    console.log('  …');
    process.exit(0);
  }

  const schoolId = await ensureDefaultSchool();
  await ensureBrandingSchoolCode(schoolId);

  const existing = await prisma.libraryBook.count();
  if (existing > 0) {
    console.log(`Bibliothèque : ${existing} ouvrage(s) déjà présents — ajout des manquants uniquement.`);
  }

  let created = 0;
  let skipped = 0;

  for (const book of LIBRARY_CATALOG) {
    const dup = await prisma.libraryBook.findFirst({
      where: {
        title: { equals: book.title, mode: 'insensitive' },
        author: { equals: book.author, mode: 'insensitive' },
      },
    });
    if (dup) {
      skipped += 1;
      continue;
    }
    await prisma.libraryBook.create({
      data: {
        ...book,
        isActive: true,
      },
    });
    created += 1;
  }

  const total = await prisma.libraryBook.count();
  console.log(`Bibliothèque restaurée : ${created} ajouté(s), ${skipped} déjà présent(s), ${total} au total.`);
  console.log('Code établissement 253798 enregistré dans le branding.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
