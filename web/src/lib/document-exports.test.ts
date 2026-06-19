import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jsPDF from 'jspdf';
import { dossierToPdfPayload, downloadHealthDossierPdf } from './healthDossierPdf';
import { downloadJobDescriptionPdf } from './jobDescriptionPdf';
import {
  generateTranlefetReportCardPdf,
  resolveProfessorForRow,
  pickPrimaryCourseForRow,
  isSingleTrimesterBulletin,
} from './tranlefetReportCardPdf';

describe('exports PDF client (jsPDF)', () => {
  it('génère un PDF fiche de poste sans erreur', () => {
    assert.doesNotThrow(() => {
      downloadJobDescriptionPdf({
        title: 'Agent comptable',
        code: 'ACC-01',
        suggestedCategory: 'ADMINISTRATION',
        summary: 'Gestion comptable.',
        responsibilities: 'Tenue des livres.',
        isActive: true,
        schoolName: 'École Test',
      });
    });
  });

  it('génère un PDF dossier santé sans erreur', () => {
    const payload = dossierToPdfPayload(
      {
        id: 'd1',
        studentId: 'MAT001',
        user: { firstName: 'Jean', lastName: 'Dupont' },
        class: { name: '6ème A', level: '6ème' },
        medicalInfo: 'RAS',
        allergies: 'Aucune',
      },
      'École Test',
    );
    assert.doesNotThrow(() => downloadHealthDossierPdf(payload));
  });

  it('génère un PDF bulletin Tranlefet (1er trimestre) sans erreur', () => {
    assert.doesNotThrow(() => {
      generateTranlefetReportCardPdf(
        {
          studentIdNumber: 'MAT002',
          user: { firstName: 'Kouamé', lastName: 'Aya' },
          class: { name: '4ème A', level: '4ème' },
          totalStudents: 28,
          average: 12.4,
          rank: 4,
          allCourses: [
            { id: 'fr', name: 'Français', teacherName: 'M. Koné' },
            { id: 'en', name: 'Anglais', teacherName: 'Mme Diabaté' },
            { id: 'ma', name: 'Mathématiques', teacherName: 'M. Ouattara' },
          ],
          courseAverages: {
            fr: { average: 11, count: 3 },
            en: { average: 13, count: 2 },
            ma: { average: 14, count: 4 },
          },
        },
        {
          periodLabel: 'Trimestre 1',
          periodKey: 'trim1',
          academicYear: '2025-2026',
        },
      );
    });
    assert.equal(isSingleTrimesterBulletin('trim1'), true);
    assert.equal(isSingleTrimesterBulletin('trim3'), false);
  });

  it('associe chaque professeur à la bonne matière sur le bulletin', () => {
    const courses = [
      { id: 'fr', name: 'Français', teacherName: 'M. Koné' },
      { id: 'en', name: 'Anglais', teacherName: 'Mme Diabaté' },
      { id: 'ma', name: 'Mathématiques', teacherName: 'M. Ouattara' },
      { id: 'hg', name: 'Histoire-Géographie', teacherName: 'M. Bamba' },
    ];

    const anglaisRow = {
      label: 'Anglais',
      courseMatch: /^anglais|english/i,
      showProfessor: true,
      coefficient: 2,
    };
    const mathsRow = {
      label: 'Mathématiques',
      courseMatch: /^math/i,
      showProfessor: true,
      coefficient: 3,
    };
    const oralRow = {
      label: 'Expression orale',
      indent: true,
      courseMatch: /français|francais/i,
      subGradeMatch: /oral/i,
      coefficient: 1,
    };

    assert.equal(resolveProfessorForRow(anglaisRow, courses), 'Mme Diabaté');
    assert.equal(resolveProfessorForRow(mathsRow, courses), 'M. Ouattara');
    assert.equal(resolveProfessorForRow(oralRow, courses), '');
    assert.equal(pickPrimaryCourseForRow(anglaisRow, courses)?.id, 'en');
  });

  it('génère un PDF bulletin Tranlefet (3e trimestre) sans erreur', () => {
    assert.doesNotThrow(() => {
      generateTranlefetReportCardPdf(
        {
          studentIdNumber: 'MAT001',
          dateOfBirth: '2012-05-01',
          gender: 'FEMALE',
          user: { firstName: 'Marie', lastName: 'Kouassi' },
          class: { name: '5ème B', level: '5ème' },
          totalStudents: 32,
          average: 14.25,
          rank: 5,
          allCourses: [
            { id: 'c1', name: 'Français', teacherName: 'M. Diallo' },
            { id: 'c2', name: 'Mathématiques', teacherName: 'Mme Traoré' },
          ],
          courseAverages: {
            c1: { average: 13.5, count: 3 },
            c2: { average: 15, count: 4 },
          },
          grades: [
            { courseId: 'c1', title: 'Expression orale', score: 14, maxScore: 20, coefficient: 1, date: '2026-05-01' },
            { courseId: 'c1', title: 'Orthographe', score: 13, maxScore: 20, coefficient: 2, date: '2026-05-02' },
          ],
          absences: { total: 2, excused: 1, unexcused: 1, late: 0 },
          termHistory: {
            trim1: { average: 12.5, rank: 8, byCourse: { c1: { average: 12, rank: 9 }, c2: { average: 13, rank: 7 } } },
            trim2: { average: 13.8, rank: 6, byCourse: { c1: { average: 13.2, rank: 7 }, c2: { average: 14.4, rank: 5 } } },
            trim3: { average: 14.25, rank: 5, byCourse: { c1: { average: 13.5, rank: 6 }, c2: { average: 15, rank: 4 } } },
          },
          annualSummary: { average: 13.52, rank: 6 },
          classStats: {
            periodAverage: 11.8,
            periodMin: 8.2,
            periodMax: 16.4,
            annualAverage: 11.5,
            annualMin: 7.9,
            annualMax: 16.1,
          },
          conduct: { average: 16, byTerm: { trim1: 15, trim2: 16, trim3: 17 } },
        },
        {
          periodLabel: 'Trimestre 3',
          periodKey: 'trim3',
          academicYear: '2025-2026',
        },
      );
    });
  });

  it('produit un flux PDF binaire via jsPDF', () => {
    const doc = new jsPDF();
    doc.text('Export test', 10, 10);
    const buf = doc.output('arraybuffer') as ArrayBuffer;
    assert.ok(buf.byteLength > 500);
    const head = new TextDecoder().decode(buf.slice(0, 5));
    assert.equal(head, '%PDF-');
  });
});
