/**
 * Vide toutes les collections Prisma sauf `users` et `user_two_factor_settings`.
 *
 * Usage : npm run clear:except-users -- --confirm
 */
import dotenv from 'dotenv';
import prisma from '../src/utils/prisma';

dotenv.config();

type PrismaDelegate = { deleteMany: (args?: object) => Promise<{ count: number }> };

/** Ordre approximatif : enfants avant parents (MongoDB n’impose pas les FK, mais plus lisible). */
const MODELS_TO_CLEAR: Array<keyof typeof prisma> = [
  'elearningQuizAttempt',
  'elearningLessonProgress',
  'elearningQuizQuestion',
  'elearningQuiz',
  'elearningLesson',
  'virtualClassSession',
  'elearningCourse',
  'pedagogicalResourceBank',
  'digitalLibraryDownloadGrant',
  'digitalLibraryResource',
  'libraryPenalty',
  'libraryReservation',
  'libraryLoan',
  'libraryBook',
  'materialStockOrderLine',
  'materialStockMovement',
  'materialAllocation',
  'materialMaintenance',
  'materialRoomReservation',
  'materialStockOrder',
  'materialStockItem',
  'materialEquipment',
  'materialRoom',
  'academicChangeRequest',
  'studentAssignment',
  'grade',
  'absence',
  'teacherAttendance',
  'schedule',
  'assignment',
  'reportCard',
  'classCouncilSession',
  'studentDisciplinaryRecord',
  'extracurricularRegistration',
  'studentOrientationPlacement',
  'studentOrientationFollowUp',
  'orientationAdvice',
  'orientationAptitudeTest',
  'orientationPartnership',
  'orientationFiliere',
  'conduct',
  'studentSubjectOption',
  'schoolTrackAvailableOption',
  'identityDocument',
  'studentSchoolHistory',
  'studentTransfer',
  'studentPickupAuthorization',
  'parentConsent',
  'parentInteraction',
  'parentContact',
  'parentTeacherAppointment',
  'studentParent',
  'healthCampaignParticipation',
  'healthEmergencyLog',
  'infirmaryVisit',
  'studentTreatment',
  'studentAllergyRecord',
  'studentVaccination',
  'studentHealthDossier',
  'healthCampaign',
  'educatorClassAssignment',
  'teacherScheduleAvailabilitySlot',
  'roomScheduleUnavailableSlot',
  'teacherAdministrativeDocument',
  'teacherProfessionalTraining',
  'teacherCareerHistory',
  'teacherQualification',
  'teacherLeave',
  'teacherPerformanceReview',
  'staffAttendance',
  'staffModuleRecord',
  'payment',
  'tuitionFee',
  'schoolExpense',
  'pettyCashMovement',
  'budgetLine',
  'admission',
  'message',
  'notification',
  'loginLog',
  'securityEvent',
  'pushSubscription',
  'auditLog',
  'passwordResetToken',
  'schoolGalleryItem',
  'announcement',
  'schoolDisciplinaryRulebook',
  'extracurricularOffering',
  'schoolCalendarEvent',
  'reportCardTemplate',
  'course',
  'class',
  'schoolTrack',
  'subjectOption',
  'tuitionPaymentScheduleTemplate',
  'tuitionFeeCatalog',
  'supplier',
  'jobDescription',
  'adminWorkspaceMember',
  'schoolMember',
  'schoolStaffMetier',
  'appBranding',
  'adminWorkspace',
  'student',
  'parent',
  'teacher',
  'educator',
  'staffMember',
  'school',
];

async function main() {
  const confirmed = process.argv.includes('--confirm');
  if (!confirmed) {
    console.error(
      'Opération destructive : relancez avec --confirm pour vider la base (sauf utilisateurs).',
    );
    process.exit(1);
  }

  const usersBefore = await prisma.user.count();
  const twoFaBefore = await prisma.userTwoFactorSettings.count();
  console.log(`Comptes utilisateurs conservés : ${usersBefore}`);
  console.log(`Paramètres 2FA conservés : ${twoFaBefore}`);
  console.log('Suppression de toutes les autres données…\n');

  let totalDeleted = 0;
  const summary: Array<{ model: string; count: number }> = [];

  for (const model of MODELS_TO_CLEAR) {
    const delegate = prisma[model] as unknown as PrismaDelegate | undefined;
    if (!delegate?.deleteMany) {
      console.warn(`Ignoré (délégué absent) : ${String(model)}`);
      continue;
    }
    const result = await delegate.deleteMany({});
    if (result.count > 0) {
      summary.push({ model: String(model), count: result.count });
      totalDeleted += result.count;
    }
  }

  const usersAfter = await prisma.user.count();
  const twoFaAfter = await prisma.userTwoFactorSettings.count();

  console.log('--- Résumé (collections non vides supprimées) ---');
  for (const row of summary.sort((a, b) => b.count - a.count)) {
    console.log(`  ${row.model}: ${row.count}`);
  }
  console.log(`\nTotal enregistrements supprimés : ${totalDeleted}`);
  console.log(`Utilisateurs restants : ${usersAfter} (attendu ${usersBefore})`);
  console.log(`2FA restants : ${twoFaAfter} (attendu ${twoFaBefore})`);

  if (usersAfter !== usersBefore) {
    console.error('ERREUR : le nombre d’utilisateurs a changé.');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
