import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateDigitalCardPublicId } from '../src/utils/digital-card.util';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed de la base de données...');

  // Nettoyer la base de données
  console.log('🧹 Nettoyage de la base de données...');
  await prisma.studentAssignment.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.tuitionFee.deleteMany();
  await prisma.tuitionPaymentScheduleTemplate.deleteMany();
  await prisma.tuitionFeeCatalog.deleteMany();
  await prisma.conduct.deleteMany();
  await prisma.reportCard.deleteMany();
  await prisma.course.deleteMany();
  await prisma.parentTeacherAppointment.deleteMany();
  await prisma.studentPickupAuthorization.deleteMany();
  await prisma.parentConsent.deleteMany();
  await prisma.parentInteraction.deleteMany();
  await prisma.parentContact.deleteMany();
  await prisma.studentParent.deleteMany();
  await prisma.elearningLessonProgress.deleteMany();
  await prisma.elearningQuizAttempt.deleteMany();
  await prisma.elearningQuizQuestion.deleteMany();
  await prisma.elearningQuiz.deleteMany();
  await prisma.elearningLesson.deleteMany();
  await prisma.virtualClassSession.deleteMany();
  await prisma.elearningCourse.deleteMany();
  await prisma.pedagogicalResourceBank.deleteMany();
  await prisma.healthCampaignParticipation.deleteMany();
  await prisma.studentVaccination.deleteMany();
  await prisma.infirmaryVisit.deleteMany();
  await prisma.studentTreatment.deleteMany();
  await prisma.studentAllergyRecord.deleteMany();
  await prisma.studentHealthDossier.deleteMany();
  await prisma.healthCampaign.deleteMany();
  await prisma.student.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.teacherLeave.deleteMany();
  await prisma.teacherPerformanceReview.deleteMany();
  await prisma.teacherAttendance.deleteMany();
  await prisma.classCouncilSession.deleteMany();
  await prisma.extracurricularRegistration.deleteMany();
  await prisma.extracurricularOffering.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.admission.deleteMany();
  await prisma.academicChangeRequest.deleteMany();
  await prisma.studentSubjectOption.deleteMany();
  await prisma.schoolTrackAvailableOption.deleteMany();
  await prisma.subjectOption.deleteMany();
  await prisma.schoolTrack.deleteMany();
  await prisma.class.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.educator.deleteMany();
  await prisma.staffAttendance.deleteMany();
  await prisma.staffModuleRecord.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.jobDescription.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.loginLog.deleteMany();
  await prisma.securityEvent.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.message.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.identityDocument.deleteMany();
  await prisma.studentSchoolHistory.deleteMany();
  await prisma.studentTransfer.deleteMany();
  await prisma.studentDisciplinaryRecord.deleteMany();
  await prisma.schoolDisciplinaryRulebook.deleteMany();
  await prisma.studentOrientationPlacement.deleteMany();
  await prisma.studentOrientationFollowUp.deleteMany();
  await prisma.orientationAdvice.deleteMany();
  await prisma.orientationAptitudeTest.deleteMany();
  await prisma.orientationPartnership.deleteMany();
  await prisma.orientationFiliere.deleteMany();
  await prisma.libraryPenalty.deleteMany();
  await prisma.libraryReservation.deleteMany();
  await prisma.libraryLoan.deleteMany();
  await prisma.libraryBook.deleteMany();
  await prisma.materialStockOrderLine.deleteMany();
  await prisma.materialStockOrder.deleteMany();
  await prisma.materialStockMovement.deleteMany();
  await prisma.materialAllocation.deleteMany();
  await prisma.materialMaintenance.deleteMany();
  await prisma.materialEquipment.deleteMany();
  await prisma.materialRoomReservation.deleteMany();
  await prisma.materialRoom.deleteMany();
  await prisma.materialStockItem.deleteMany();
  await prisma.schoolExpense.deleteMany();
  await prisma.pettyCashMovement.deleteMany();
  await prisma.budgetLine.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.teacherAdministrativeDocument.deleteMany();
  await prisma.reportCardTemplate.deleteMany();
  await prisma.schoolGalleryItem.deleteMany();
  await prisma.schoolCalendarEvent.deleteMany();
  await prisma.roomScheduleUnavailableSlot.deleteMany();
  await prisma.appBranding.deleteMany();
  await prisma.userTwoFactorSettings.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Créer des utilisateurs ADMIN
  console.log('👤 Création des administrateurs...');
  const admin1 = await prisma.user.create({
    data: {
      email: 'admin@school.com',
      password: hashedPassword,
      firstName: 'Jean',
      lastName: 'Dupont',
      role: 'ADMIN',
      phone: '+33 6 12 34 56 78',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      email: 'superadmin@tranlefet.ci',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin CPTB',
      role: 'SUPER_ADMIN',
      phone: '0788948712',
      isActive: true,
    },
  });

  // Créer des enseignants
  console.log('👨‍🏫 Création des enseignants...');
  const teacher1 = await prisma.user.create({
    data: {
      email: 'teacher1@school.com',
      password: hashedPassword,
      firstName: 'Marie',
      lastName: 'Martin',
      role: 'TEACHER',
      phone: '+33 6 11 22 33 44',
      isActive: true,
      teacherProfile: {
        create: {
          employeeId: 'EMP001',
          specialization: 'Mathématiques',
          hireDate: new Date('2020-09-01'),
          contractType: 'CDI',
          salary: 3500,
        },
      },
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      email: 'teacher2@school.com',
      password: hashedPassword,
      firstName: 'Pierre',
      lastName: 'Durand',
      role: 'TEACHER',
      phone: '+33 6 22 33 44 55',
      isActive: true,
      teacherProfile: {
        create: {
          employeeId: 'EMP002',
          specialization: 'Français',
          hireDate: new Date('2019-09-01'),
          contractType: 'CDI',
          salary: 3400,
        },
      },
    },
  });

  const teacher3 = await prisma.user.create({
    data: {
      email: 'teacher3@school.com',
      password: hashedPassword,
      firstName: 'Sophie',
      lastName: 'Bernard',
      role: 'TEACHER',
      phone: '+33 6 33 44 55 66',
      isActive: true,
      teacherProfile: {
        create: {
          employeeId: 'EMP003',
          specialization: 'Histoire-Géographie',
          hireDate: new Date('2021-09-01'),
          contractType: 'CDD',
          salary: 3300,
        },
      },
    },
  });

  const teacher1Profile = await prisma.teacher.findUnique({
    where: { userId: teacher1.id },
  });
  const teacher2Profile = await prisma.teacher.findUnique({
    where: { userId: teacher2.id },
  });
  const teacher3Profile = await prisma.teacher.findUnique({
    where: { userId: teacher3.id },
  });

  // Créer des classes
  console.log('📚 Création des classes...');
  const class1 = await prisma.class.create({
    data: {
      name: '6ème A',
      level: '6ème',
      room: 'Salle 101',
      capacity: 30,
      academicYear: '2024-2025',
      teacherId: teacher1Profile!.id,
    },
  });

  const class2 = await prisma.class.create({
    data: {
      name: '5ème B',
      level: '5ème',
      room: 'Salle 102',
      capacity: 28,
      academicYear: '2024-2025',
      teacherId: teacher2Profile!.id,
    },
  });

  // Créer des cours
  console.log('📖 Création des cours...');
  const course1 = await prisma.course.create({
    data: {
      name: 'Mathématiques',
      code: 'MATH-6A',
      description: 'Cours de mathématiques niveau 6ème',
      classId: class1.id,
      teacherId: teacher1Profile!.id,
    },
  });

  const course2 = await prisma.course.create({
    data: {
      name: 'Français',
      code: 'FR-6A',
      description: 'Cours de français niveau 6ème',
      classId: class1.id,
      teacherId: teacher2Profile!.id,
    },
  });

  const course3 = await prisma.course.create({
    data: {
      name: 'Histoire-Géographie',
      code: 'HG-6A',
      description: 'Cours d\'histoire-géographie niveau 6ème',
      classId: class1.id,
      teacherId: teacher3Profile!.id,
    },
  });

  const course4 = await prisma.course.create({
    data: {
      name: 'Mathématiques',
      code: 'MATH-5B',
      description: 'Cours de mathématiques niveau 5ème',
      classId: class2.id,
      teacherId: teacher1Profile!.id,
    },
  });

  const course5 = await prisma.course.create({
    data: {
      name: 'Français',
      code: 'FR-5B',
      description: 'Cours de français niveau 5ème',
      classId: class2.id,
      teacherId: teacher2Profile!.id,
    },
  });

  // Créer des élèves
  console.log('👨‍🎓 Création des élèves...');
  const student1 = await prisma.user.create({
    data: {
      email: 'student1@school.com',
      password: hashedPassword,
      firstName: 'Lucas',
      lastName: 'Moreau',
      role: 'STUDENT',
      phone: '+33 6 44 55 66 77',
      isActive: true,
      studentProfile: {
        create: {
          studentId: 'STU001',
          digitalCardPublicId: generateDigitalCardPublicId(),
          dateOfBirth: new Date('2012-05-15'),
          gender: 'MALE',
          address: '123 Rue de la République, 75001 Paris',
          emergencyContact: 'Mme Moreau',
          emergencyPhone: '+33 6 55 66 77 88',
          medicalInfo: 'Aucune allergie connue',
          enrollmentDate: new Date('2024-09-01'),
          classId: class1.id,
        },
      },
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: 'student2@school.com',
      password: hashedPassword,
      firstName: 'Emma',
      lastName: 'Lefebvre',
      role: 'STUDENT',
      phone: '+33 6 55 66 77 88',
      isActive: true,
      studentProfile: {
        create: {
          studentId: 'STU002',
          digitalCardPublicId: generateDigitalCardPublicId(),
          dateOfBirth: new Date('2012-08-20'),
          gender: 'FEMALE',
          address: '456 Avenue des Champs, 75008 Paris',
          emergencyContact: 'M. Lefebvre',
          emergencyPhone: '+33 6 66 77 88 99',
          medicalInfo: 'Asthme léger',
          enrollmentDate: new Date('2024-09-01'),
          classId: class1.id,
        },
      },
    },
  });

  const student3 = await prisma.user.create({
    data: {
      email: 'student3@school.com',
      password: hashedPassword,
      firstName: 'Thomas',
      lastName: 'Garcia',
      role: 'STUDENT',
      phone: '+33 6 66 77 88 99',
      isActive: true,
      studentProfile: {
        create: {
          studentId: 'STU003',
          digitalCardPublicId: generateDigitalCardPublicId(),
          dateOfBirth: new Date('2012-03-10'),
          gender: 'MALE',
          address: '789 Boulevard Saint-Germain, 75006 Paris',
          emergencyContact: 'Mme Garcia',
          emergencyPhone: '+33 6 77 88 99 00',
          medicalInfo: 'Aucune',
          enrollmentDate: new Date('2024-09-01'),
          classId: class1.id,
        },
      },
    },
  });

  const student4 = await prisma.user.create({
    data: {
      email: 'student4@school.com',
      password: hashedPassword,
      firstName: 'Chloé',
      lastName: 'Roux',
      role: 'STUDENT',
      phone: '+33 6 10 20 30 40',
      isActive: true,
      studentProfile: {
        create: {
          studentId: 'STU004',
          digitalCardPublicId: generateDigitalCardPublicId(),
          dateOfBirth: new Date('2011-11-22'),
          gender: 'FEMALE',
          address: '12 rue des Écoles, Paris',
          emergencyContact: 'M. Roux',
          emergencyPhone: '+33 6 20 30 40 50',
          medicalInfo: 'Aucune',
          enrollmentDate: new Date('2024-09-01'),
          classId: class2.id,
        },
      },
    },
  });

  const student5 = await prisma.user.create({
    data: {
      email: 'student5@school.com',
      password: hashedPassword,
      firstName: 'Hugo',
      lastName: 'Blanc',
      role: 'STUDENT',
      phone: '+33 6 11 21 31 41',
      isActive: true,
      studentProfile: {
        create: {
          studentId: 'STU005',
          digitalCardPublicId: generateDigitalCardPublicId(),
          dateOfBirth: new Date('2011-04-18'),
          gender: 'MALE',
          address: '8 avenue Voltaire, Paris',
          emergencyContact: 'Mme Blanc',
          emergencyPhone: '+33 6 21 31 41 51',
          medicalInfo: 'Aucune',
          enrollmentDate: new Date('2024-09-01'),
          classId: class2.id,
        },
      },
    },
  });

  const student6 = await prisma.user.create({
    data: {
      email: 'student6@school.com',
      password: hashedPassword,
      firstName: 'Léa',
      lastName: 'Noir',
      role: 'STUDENT',
      phone: '+33 6 12 22 32 42',
      isActive: true,
      studentProfile: {
        create: {
          studentId: 'STU006',
          digitalCardPublicId: generateDigitalCardPublicId(),
          dateOfBirth: new Date('2011-07-30'),
          gender: 'FEMALE',
          address: '5 place d’Italie, Paris',
          emergencyContact: 'M. Noir',
          emergencyPhone: '+33 6 22 32 42 52',
          medicalInfo: 'Aucune',
          enrollmentDate: new Date('2024-09-01'),
          classId: class2.id,
        },
      },
    },
  });

  const student7 = await prisma.user.create({
    data: {
      email: 'student7@school.com',
      password: hashedPassword,
      firstName: 'Nathan',
      lastName: 'Klein',
      role: 'STUDENT',
      phone: '+33 6 13 23 33 43',
      isActive: true,
      studentProfile: {
        create: {
          studentId: 'STU007',
          digitalCardPublicId: generateDigitalCardPublicId(),
          dateOfBirth: new Date('2012-01-25'),
          gender: 'MALE',
          address: '22 rue Monge, Paris',
          emergencyContact: 'Mme Klein',
          emergencyPhone: '+33 6 23 33 43 53',
          medicalInfo: 'Aucune',
          enrollmentDate: new Date('2024-09-01'),
          classId: class1.id,
        },
      },
    },
  });

  const student8 = await prisma.user.create({
    data: {
      email: 'student8@school.com',
      password: hashedPassword,
      firstName: 'Inès',
      lastName: 'Benali',
      role: 'STUDENT',
      phone: '+33 6 14 24 34 44',
      isActive: true,
      studentProfile: {
        create: {
          studentId: 'STU008',
          digitalCardPublicId: generateDigitalCardPublicId(),
          dateOfBirth: new Date('2012-09-12'),
          gender: 'FEMALE',
          address: '9 boulevard de Belleville, Paris',
          emergencyContact: 'M. Benali',
          emergencyPhone: '+33 6 24 34 44 54',
          medicalInfo: 'Aucune',
          enrollmentDate: new Date('2024-09-01'),
          classId: class1.id,
        },
      },
    },
  });

  const student9 = await prisma.user.create({
    data: {
      email: 'student9@school.com',
      password: hashedPassword,
      firstName: 'Max',
      lastName: 'Perrot',
      role: 'STUDENT',
      phone: '+33 6 15 25 35 45',
      isActive: true,
      studentProfile: {
        create: {
          studentId: 'STU009',
          digitalCardPublicId: generateDigitalCardPublicId(),
          dateOfBirth: new Date('2011-12-05'),
          gender: 'MALE',
          address: '3 rue de la Grange, Paris',
          emergencyContact: 'Mme Perrot',
          emergencyPhone: '+33 6 25 35 45 55',
          medicalInfo: 'Aucune',
          enrollmentDate: new Date('2024-09-01'),
          classId: class2.id,
        },
      },
    },
  });

  const student1Profile = await prisma.student.findUnique({
    where: { userId: student1.id },
  });
  const student2Profile = await prisma.student.findUnique({
    where: { userId: student2.id },
  });
  const student3Profile = await prisma.student.findUnique({
    where: { userId: student3.id },
  });
  const student4Profile = await prisma.student.findUnique({
    where: { userId: student4.id },
  });
  const student5Profile = await prisma.student.findUnique({
    where: { userId: student5.id },
  });
  const student6Profile = await prisma.student.findUnique({
    where: { userId: student6.id },
  });
  const student7Profile = await prisma.student.findUnique({
    where: { userId: student7.id },
  });
  const student8Profile = await prisma.student.findUnique({
    where: { userId: student8.id },
  });
  const student9Profile = await prisma.student.findUnique({
    where: { userId: student9.id },
  });

  // Créer des parents
  console.log('👨‍👩‍👧 Création des parents...');
  const parent1 = await prisma.user.create({
    data: {
      email: 'parent1@school.com',
      password: hashedPassword,
      firstName: 'Claire',
      lastName: 'Moreau',
      role: 'PARENT',
      phone: '+33 6 55 66 77 88',
      isActive: true,
      parentProfile: {
        create: {
          profession: 'Ingénieur',
        },
      },
    },
  });

  const parent2 = await prisma.user.create({
    data: {
      email: 'parent2@school.com',
      password: hashedPassword,
      firstName: 'Marc',
      lastName: 'Lefebvre',
      role: 'PARENT',
      phone: '+33 6 66 77 88 99',
      isActive: true,
      parentProfile: {
        create: {
          profession: 'Médecin',
        },
      },
    },
  });

  const parent1Profile = await prisma.parent.findUnique({
    where: { userId: parent1.id },
  });
  const parent2Profile = await prisma.parent.findUnique({
    where: { userId: parent2.id },
  });

  // Lier les parents aux élèves
  console.log('🔗 Liaison parents-élèves...');
  await prisma.studentParent.create({
    data: {
      studentId: student1Profile!.id,
      parentId: parent1Profile!.id,
      relation: 'mother',
    },
  });

  // Créer des éducateurs
  console.log('👨‍🏫 Création des éducateurs...');
  const educator1 = await prisma.user.create({
    data: {
      email: 'educator1@school.com',
      password: hashedPassword,
      firstName: 'Luc',
      lastName: 'Petit',
      role: 'EDUCATOR',
      phone: '+33 6 77 88 99 00',
      isActive: true,
      educatorProfile: {
        create: {
          employeeId: 'EDU001',
          specialization: 'Soutien scolaire et orientation',
          hireDate: new Date('2020-09-01'),
          contractType: 'CDI',
          salary: 3200,
        },
      },
    },
  });

  const educator2 = await prisma.user.create({
    data: {
      email: 'educator2@school.com',
      password: hashedPassword,
      firstName: 'Julie',
      lastName: 'Rousseau',
      role: 'EDUCATOR',
      phone: '+33 6 88 99 00 11',
      isActive: true,
      educatorProfile: {
        create: {
          employeeId: 'EDU002',
          specialization: 'Accompagnement éducatif',
          hireDate: new Date('2021-09-01'),
          contractType: 'CDI',
          salary: 3100,
        },
      },
    },
  });

  // Personnel de soutien (espace personnel /staff)
  console.log('🧑‍💼 Création du personnel de soutien (STAFF)...');
  await prisma.user.create({
    data: {
      email: 'secretary@school.com',
      password: hashedPassword,
      firstName: 'Aminata',
      lastName: 'Koné',
      role: 'STAFF',
      phone: '+225 07 00 00 01',
      isActive: true,
      staffProfile: {
        create: {
          employeeId: 'STF001',
          staffCategory: 'SUPPORT',
          supportKind: 'SECRETARY',
          jobTitle: 'Secrétaire de direction',
          department: 'Administration',
          hireDate: new Date('2019-09-01'),
          contractType: 'CDI',
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      email: 'bursar@school.com',
      password: hashedPassword,
      firstName: 'Ibrahim',
      lastName: 'Traoré',
      role: 'STAFF',
      phone: '+225 07 00 00 02',
      isActive: true,
      staffProfile: {
        create: {
          employeeId: 'STF002',
          staffCategory: 'SUPPORT',
          supportKind: 'BURSAR',
          jobTitle: 'Économe',
          department: 'Finances',
          hireDate: new Date('2018-09-01'),
          contractType: 'CDI',
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      email: 'studies@school.com',
      password: hashedPassword,
      firstName: 'Fatou',
      lastName: 'Diallo',
      role: 'STAFF',
      phone: '+225 07 00 00 03',
      isActive: true,
      staffProfile: {
        create: {
          employeeId: 'STF003',
          staffCategory: 'SUPPORT',
          supportKind: 'STUDIES_DIRECTOR',
          jobTitle: 'Directrice des études',
          department: 'Pédagogie',
          hireDate: new Date('2017-09-01'),
          contractType: 'CDI',
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      email: 'nurse@school.com',
      password: hashedPassword,
      firstName: 'Aïcha',
      lastName: 'Ouattara',
      role: 'STAFF',
      phone: '+225 07 00 00 04',
      isActive: true,
      staffProfile: {
        create: {
          employeeId: 'STF004',
          staffCategory: 'SUPPORT',
          supportKind: 'NURSE',
          jobTitle: 'Infirmière scolaire',
          department: 'Santé',
          hireDate: new Date('2020-09-01'),
          contractType: 'CDI',
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      email: 'librarian@school.com',
      password: hashedPassword,
      firstName: 'Kouadio',
      lastName: 'Yao',
      role: 'STAFF',
      phone: '+225 07 00 00 05',
      isActive: true,
      staffProfile: {
        create: {
          employeeId: 'STF005',
          staffCategory: 'SUPPORT',
          supportKind: 'LIBRARIAN',
          jobTitle: 'Bibliothécaire',
          department: 'Documentation',
          hireDate: new Date('2021-09-01'),
          contractType: 'CDI',
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      email: 'accountant@school.com',
      password: hashedPassword,
      firstName: 'Moussa',
      lastName: 'Camara',
      role: 'STAFF',
      phone: '+225 07 00 00 06',
      isActive: true,
      staffProfile: {
        create: {
          employeeId: 'STF006',
          staffCategory: 'SUPPORT',
          supportKind: 'ACCOUNTANT',
          jobTitle: 'Comptable',
          department: 'Finances',
          hireDate: new Date('2019-09-01'),
          contractType: 'CDI',
        },
      },
    },
  });

  const nurseStaff = await prisma.staffMember.findFirst({
    where: { employeeId: 'STF004' },
  });
  const secretaryStaff = await prisma.staffMember.findFirst({
    where: { employeeId: 'STF001' },
  });

  await prisma.studentParent.create({
    data: {
      studentId: student2Profile!.id,
      parentId: parent2Profile!.id,
      relation: 'father',
    },
  });

  // Créer des notes (volume pour graphiques : plusieurs mois + toutes les classes)
  console.log('📝 Création des notes...');
  type CourseRef = { id: string; teacherId: string };
  const class1Courses: CourseRef[] = [
    { id: course1.id, teacherId: teacher1Profile!.id },
    { id: course2.id, teacherId: teacher2Profile!.id },
    { id: course3.id, teacherId: teacher3Profile!.id },
  ];
  const class2Courses: CourseRef[] = [
    { id: course4.id, teacherId: teacher1Profile!.id },
    { id: course5.id, teacherId: teacher2Profile!.id },
  ];

  const trendMonths = [
    new Date('2025-09-18'),
    new Date('2025-10-22'),
    new Date('2025-11-14'),
    new Date('2025-12-09'),
    new Date('2026-01-28'),
    new Date('2026-02-19'),
    new Date('2026-03-11'),
    new Date('2026-04-08'),
    new Date('2026-05-02'),
  ];

  const evaluationCycle = ['EXAM', 'EVALUATION', 'CLASS_HOMEWORK', 'LEVEL_HOMEWORK', 'HOME_EXERCISE'] as const;
  const gradeRows: {
    studentId: string;
    courseId: string;
    teacherId: string;
    evaluationType: (typeof evaluationCycle)[number];
    title: string;
    score: number;
    maxScore: number;
    coefficient: number;
    date: Date;
    comments?: string;
  }[] = [];

  const pushGrades = (studentId: string, courses: CourseRef[], offset: number) => {
    courses.forEach((c, ci) => {
      trendMonths.forEach((date, mi) => {
        const score = 10 + ((offset + ci * 2 + mi * 3) % 9);
        gradeRows.push({
          studentId,
          courseId: c.id,
          teacherId: c.teacherId,
          evaluationType: evaluationCycle[mi % evaluationCycle.length],
          title: `Évaluation ${mi + 1}`,
          score,
          maxScore: 20,
          coefficient: mi % 4 === 0 ? 2 : 1,
          date,
          comments: score >= 14 ? 'Satisfaisant' : 'À renforcer',
        });
      });
    });
  };

  const studentsClass1 = [
    student1Profile!,
    student2Profile!,
    student3Profile!,
    student7Profile!,
    student8Profile!,
  ];
  const studentsClass2 = [
    student4Profile!,
    student5Profile!,
    student6Profile!,
    student9Profile!,
  ];

  studentsClass1.forEach((s, i) => pushGrades(s.id, class1Courses, i));
  studentsClass2.forEach((s, i) => pushGrades(s.id, class2Courses, i + 10));

  await prisma.grade.createMany({ data: gradeRows });

  // Créer des absences (réparties sur plusieurs mois pour les graphiques)
  console.log('📋 Création des absences...');
  await prisma.absence.createMany({
    data: [
      {
        studentId: student1Profile!.id,
        courseId: course1.id,
        teacherId: teacher1Profile!.id,
        date: new Date('2025-10-10'),
        status: 'ABSENT',
        reason: 'Maladie',
        excused: true,
      },
      {
        studentId: student2Profile!.id,
        courseId: course2.id,
        teacherId: teacher2Profile!.id,
        date: new Date('2025-11-12'),
        status: 'LATE',
        reason: 'Retard transport',
        excused: true,
      },
      {
        studentId: student3Profile!.id,
        courseId: course3.id,
        teacherId: teacher3Profile!.id,
        date: new Date('2025-12-03'),
        status: 'ABSENT',
        reason: 'Rendez-vous médical',
        excused: true,
      },
      {
        studentId: student4Profile!.id,
        courseId: course4.id,
        teacherId: teacher1Profile!.id,
        date: new Date('2026-01-15'),
        status: 'ABSENT',
        reason: 'Maladie',
        excused: false,
      },
      {
        studentId: student5Profile!.id,
        courseId: course5.id,
        teacherId: teacher2Profile!.id,
        date: new Date('2026-02-07'),
        status: 'LATE',
        reason: 'Transport',
        excused: true,
      },
      {
        studentId: student7Profile!.id,
        courseId: course1.id,
        teacherId: teacher1Profile!.id,
        date: new Date('2026-03-20'),
        status: 'ABSENT',
        reason: 'Famille',
        excused: true,
      },
      {
        studentId: student8Profile!.id,
        courseId: course2.id,
        teacherId: teacher2Profile!.id,
        date: new Date('2026-04-14'),
        status: 'LATE',
        reason: 'Réveil tardif',
        excused: false,
      },
      {
        studentId: student9Profile!.id,
        courseId: course4.id,
        teacherId: teacher1Profile!.id,
        date: new Date('2026-05-02'),
        status: 'ABSENT',
        reason: 'Sans justification',
        excused: false,
      },
    ],
  });

  // Créer des devoirs
  console.log('📚 Création des devoirs...');
  const assignment1 = await prisma.assignment.create({
    data: {
      courseId: course1.id,
      teacherId: teacher1Profile!.id,
      title: 'Exercices de mathématiques - Chapitre 2',
      description: 'Faire les exercices 1 à 10 page 45 du manuel',
      dueDate: new Date('2024-11-01'),
      attachments: [],
    },
  });

  const assignment2 = await prisma.assignment.create({
    data: {
      courseId: course2.id,
      teacherId: teacher2Profile!.id,
      title: 'Rédaction - Mon animal préféré',
      description: 'Écrire une rédaction de 200 mots sur votre animal préféré',
      dueDate: new Date('2024-11-05'),
      attachments: [],
    },
  });

  const assignment3 = await prisma.assignment.create({
    data: {
      courseId: course4.id,
      teacherId: teacher1Profile!.id,
      title: 'Problèmes - Fractions et proportions',
      description: 'Exercices 15 à 28 page 112',
      dueDate: new Date('2026-05-15'),
      attachments: [],
    },
  });

  const assignment4 = await prisma.assignment.create({
    data: {
      courseId: course5.id,
      teacherId: teacher2Profile!.id,
      title: 'Lecture analytique - poésie',
      description: 'Analyser le sonnet fourni en cours',
      dueDate: new Date('2026-05-20'),
      attachments: [],
    },
  });

  const allStudentIds = [
    student1Profile!.id,
    student2Profile!.id,
    student3Profile!.id,
    student4Profile!.id,
    student5Profile!.id,
    student6Profile!.id,
    student7Profile!.id,
    student8Profile!.id,
    student9Profile!.id,
  ];

  // Créer les entrées pour les devoirs des élèves (tous les élèves ont une ligne par devoir)
  const studentAssignmentRows: {
    studentId: string;
    assignmentId: string;
    submitted: boolean;
    submittedAt?: Date;
    fileUrl?: string;
    grade?: number;
    feedback?: string;
  }[] = [];

  const pickSubmitted = (studentIndex: number, assignmentIndex: number) =>
    (studentIndex + assignmentIndex * 2) % 3 !== 0;

  const assignmentsList = [assignment1, assignment2, assignment3, assignment4];
  allStudentIds.forEach((sid, si) => {
    assignmentsList.forEach((a, ai) => {
      const submitted = pickSubmitted(si, ai);
      studentAssignmentRows.push({
        studentId: sid,
        assignmentId: a.id,
        submitted,
        submittedAt: submitted ? new Date('2026-04-20T14:00:00') : undefined,
        fileUrl: submitted ? `https://example.com/a${ai}-st${si}.pdf` : undefined,
        grade: submitted ? 12 + ((si + ai) % 7) : undefined,
        feedback: submitted ? 'Remis dans les temps' : undefined,
      });
    });
  });

  await prisma.studentAssignment.createMany({ data: studentAssignmentRows });

  // Créer un emploi du temps
  console.log('📅 Création de l\'emploi du temps...');
  await prisma.schedule.createMany({
    data: [
      {
        classId: class1.id,
        courseId: course1.id,
        dayOfWeek: 1, // Lundi
        startTime: '08:00',
        endTime: '09:00',
        room: 'Salle 101',
      },
      {
        classId: class1.id,
        courseId: course2.id,
        dayOfWeek: 1, // Lundi
        startTime: '09:00',
        endTime: '10:00',
        room: 'Salle 101',
      },
      {
        classId: class1.id,
        courseId: course3.id,
        dayOfWeek: 2, // Mardi
        startTime: '10:00',
        endTime: '11:00',
        room: 'Salle 103',
      },
      {
        classId: class1.id,
        courseId: course1.id,
        dayOfWeek: 3, // Mercredi
        startTime: '08:00',
        endTime: '09:00',
        room: 'Salle 101',
      },
      {
        classId: class1.id,
        courseId: course2.id,
        dayOfWeek: 4, // Jeudi
        startTime: '14:00',
        endTime: '15:00',
        room: 'Salle 101',
      },
      {
        classId: class1.id,
        courseId: course3.id,
        dayOfWeek: 5, // Vendredi
        startTime: '10:00',
        endTime: '11:00',
        room: 'Salle 103',
      },
    ],
  });

  const academicYear = '2024-2025';

  // Admissions & pré-inscriptions
  console.log('📥 Création des admissions...');
  await prisma.admission.createMany({
    data: [
      {
        reference: 'ADM-2025-001',
        status: 'PENDING',
        firstName: 'Yao',
        lastName: 'Koffi',
        email: 'yao.koffi@example.com',
        phone: '+225 07 11 22 33',
        dateOfBirth: new Date('2013-03-15'),
        gender: 'MALE',
        desiredLevel: '6ème',
        academicYear,
        previousSchool: 'École primaire Les Palmiers',
        parentName: 'Mme Koffi',
        parentPhone: '+225 07 11 22 34',
        motivation: 'Souhaite intégrer le collège pour la qualité du suivi.',
        proposedClassId: class1.id,
      },
      {
        reference: 'ADM-2025-002',
        status: 'UNDER_REVIEW',
        firstName: 'Aya',
        lastName: 'Sanogo',
        email: 'aya.sanogo@example.com',
        phone: '+225 07 22 33 44',
        dateOfBirth: new Date('2012-08-20'),
        gender: 'FEMALE',
        desiredLevel: '5ème',
        academicYear,
        previousSchool: 'Groupe scolaire Horizon',
        parentName: 'M. Sanogo',
        parentEmail: 'sanogo.pere@example.com',
        adminNotes: 'Dossier complet — vérifier pièce d’identité.',
        proposedClassId: class2.id,
        reviewedById: admin1.id,
        reviewedAt: new Date('2026-04-10'),
      },
      {
        reference: 'ADM-2025-003',
        status: 'ACCEPTED',
        firstName: 'Issa',
        lastName: 'Bamba',
        email: 'issa.bamba@example.com',
        dateOfBirth: new Date('2013-01-08'),
        gender: 'MALE',
        desiredLevel: '6ème',
        academicYear,
        parentName: 'Mme Bamba',
        parentPhone: '+225 07 33 44 55',
        proposedClassId: class1.id,
        reviewedById: admin1.id,
        reviewedAt: new Date('2026-04-15'),
      },
      {
        reference: 'ADM-2025-004',
        status: 'WAITLIST',
        firstName: 'Mariam',
        lastName: 'Coulibaly',
        email: 'mariam.c@example.com',
        dateOfBirth: new Date('2012-11-30'),
        gender: 'FEMALE',
        desiredLevel: '5ème',
        academicYear,
        adminNotes: 'Liste d’attente — classe complète.',
        proposedClassId: class2.id,
      },
      {
        reference: 'ADM-2025-006',
        status: 'UNDER_REVIEW',
        firstName: 'Kader',
        lastName: 'Touré',
        email: 'kader.toure@example.com',
        phone: '+225 07 55 66 77',
        dateOfBirth: new Date('2008-04-02'),
        gender: 'MALE',
        desiredLevel: 'Terminale',
        academicYear,
        previousSchool: 'Lycée moderne d’Abidjan',
        parentName: 'M. Touré',
        parentPhone: '+225 07 55 66 78',
        gradeTerm1: 13.5,
        gradeTerm2: 14.2,
        gradeAnnualGeneral: 13.85,
        gradeAnnualSpecific: 15.0,
        gradeAnnualLiterary: 12.75,
        motivation: 'Candidature en Terminale — série générale.',
      },
      {
        reference: 'ADM-2025-005',
        status: 'REJECTED',
        firstName: 'Eric',
        lastName: 'N’Guessan',
        email: 'eric.ng@example.com',
        dateOfBirth: new Date('2014-05-12'),
        gender: 'MALE',
        desiredLevel: '6ème',
        academicYear,
        adminNotes: 'Niveau scolaire insuffisant pour l’entrée en 6ème.',
        reviewedById: admin1.id,
        reviewedAt: new Date('2026-03-20'),
      },
    ],
  });

  // Rendez-vous parents–enseignants
  console.log('📅 Création des rendez-vous parents–enseignants...');
  await prisma.parentTeacherAppointment.createMany({
    data: [
      {
        parentId: parent1Profile!.id,
        teacherId: teacher1Profile!.id,
        studentId: student1Profile!.id,
        scheduledStart: new Date('2026-05-20T10:00:00'),
        durationMinutes: 30,
        topic: 'Progrès en mathématiques',
        status: 'CONFIRMED',
      },
      {
        parentId: parent2Profile!.id,
        teacherId: teacher2Profile!.id,
        studentId: student4Profile!.id,
        scheduledStart: new Date('2026-05-22T14:30:00'),
        durationMinutes: 45,
        topic: 'Comportement et assiduité',
        status: 'PENDING',
      },
      {
        parentId: parent1Profile!.id,
        teacherId: teacher2Profile!.id,
        studentId: student2Profile!.id,
        scheduledStart: new Date('2026-05-08T09:00:00'),
        durationMinutes: 30,
        topic: 'Français — difficultés de rédaction',
        status: 'COMPLETED',
        notesTeacher: 'Plan de soutien proposé pour juin.',
      },
      {
        parentId: parent2Profile!.id,
        teacherId: teacher1Profile!.id,
        studentId: student5Profile!.id,
        scheduledStart: new Date('2026-06-02T11:00:00'),
        durationMinutes: 30,
        topic: 'Orientation fin de cycle',
        status: 'PENDING',
      },
    ],
  });

  // Frais de scolarité & paiements
  console.log('💰 Création des frais et paiements...');
  const tuitionCatalog = await prisma.tuitionFeeCatalog.create({
    data: {
      label: 'Scolarité 6ème — trimestre',
      academicYear,
      scope: 'BY_LEVEL',
      classLevel: '6ème',
      feeType: 'TUITION',
      billingPeriod: 'QUARTERLY',
      defaultAmount: 85000,
      periodLabelHint: 'Trimestre',
      sortOrder: 1,
    },
  });
  const scheduleTemplate = await prisma.tuitionPaymentScheduleTemplate.create({
    data: {
      name: 'Trimestre en 2 versements',
      academicYear,
      description: '40 % à l’échéance, 60 % à +30 jours',
      lines: [
        { label: 'Acompte', percentOfTotal: 40, dueOffsetDays: 0 },
        { label: 'Solde', percentOfTotal: 60, dueOffsetDays: 30 },
      ],
    },
  });

  const feePaid = await prisma.tuitionFee.create({
    data: {
      studentId: student1Profile!.id,
      academicYear,
      period: 'Trimestre 2',
      amount: 85000,
      baseAmount: 85000,
      dueDate: new Date('2026-01-15'),
      description: 'Scolarité T2',
      feeType: 'TUITION',
      billingPeriod: 'QUARTERLY',
      catalogId: tuitionCatalog.id,
      scheduleTemplateId: scheduleTemplate.id,
      installmentIndex: 1,
      isPaid: true,
      paidAt: new Date('2026-01-10'),
      invoiceNumber: 'FAC-2026-0042',
      invoiceIssuedAt: new Date('2026-01-05'),
    },
  });
  await prisma.payment.create({
    data: {
      tuitionFeeId: feePaid.id,
      studentId: student1Profile!.id,
      payerId: parent1.id,
      payerRole: 'PARENT',
      amount: 85000,
      paymentMethod: 'MOBILE_MONEY',
      status: 'COMPLETED',
      paymentReference: 'PAY-SEED-001',
      paidAt: new Date('2026-01-10'),
    },
  });

  const feeUnpaid = await prisma.tuitionFee.create({
    data: {
      studentId: student2Profile!.id,
      academicYear,
      period: 'Trimestre 2',
      amount: 85000,
      dueDate: new Date('2026-05-01'),
      description: 'Scolarité T2 — en attente',
      feeType: 'TUITION',
      catalogId: tuitionCatalog.id,
      isPaid: false,
      invoiceNumber: 'FAC-2026-0087',
      invoiceIssuedAt: new Date('2026-04-01'),
    },
  });
  await prisma.tuitionFee.createMany({
    data: [
      {
        studentId: student3Profile!.id,
        academicYear,
        period: 'Cantine — mai',
        amount: 12000,
        dueDate: new Date('2026-05-05'),
        description: 'Cantine mensuelle',
        feeType: 'CANTEEN',
        isPaid: false,
      },
      {
        studentId: student4Profile!.id,
        academicYear,
        period: 'Transport — trimestre',
        amount: 25000,
        dueDate: new Date('2026-04-20'),
        description: 'Bus scolaire T2',
        feeType: 'TRANSPORT',
        isPaid: true,
        paidAt: new Date('2026-04-18'),
      },
    ],
  });
  await prisma.payment.create({
    data: {
      tuitionFeeId: feeUnpaid.id,
      studentId: student2Profile!.id,
      payerId: parent1.id,
      payerRole: 'PARENT',
      amount: 34000,
      paymentMethod: 'CASH',
      status: 'PENDING',
      notes: 'Acompte partiel au guichet',
    },
  });

  // Annonces & calendrier
  console.log('📢 Création des annonces et événements...');
  await prisma.announcement.createMany({
    data: [
      {
        authorId: admin1.id,
        title: 'Réunion parents 6ème A',
        content: 'Réunion d’information le vendredi 23 mai à 17 h en salle polyvalente.',
        targetClassId: class1.id,
        priority: 'high',
        portalCategory: 'circular',
        published: true,
        publishedAt: new Date('2026-05-01'),
      },
      {
        authorId: admin1.id,
        title: 'Journée portes ouvertes',
        content: 'Inscriptions ouvertes pour l’année 2025-2026 — visite guidée de 9 h à 16 h.',
        priority: 'normal',
        portalCategory: 'news',
        published: true,
        publishedAt: new Date('2026-04-25'),
      },
      {
        authorId: admin1.id,
        title: 'Rappel tenue scolaire',
        content: 'Merci de vérifier l’uniforme et les chaussures avant les examens blancs.',
        targetRole: 'STUDENT',
        priority: 'normal',
        published: true,
        publishedAt: new Date('2026-05-10'),
      },
    ],
  });
  await prisma.schoolCalendarEvent.createMany({
    data: [
      {
        title: 'Examens blancs — 6ème',
        description: 'Maths et français',
        startDate: new Date('2026-05-25'),
        endDate: new Date('2026-05-27'),
        type: 'EXAM_PERIOD',
        academicYear,
      },
      {
        title: 'Conseil de classe T2',
        startDate: new Date('2026-06-10'),
        endDate: new Date('2026-06-10'),
        type: 'MEETING',
        academicYear,
      },
    ],
  });

  // Conseils de classe
  console.log('🏫 Création des conseils de classe...');
  await prisma.classCouncilSession.createMany({
    data: [
      {
        classId: class1.id,
        period: 'Trimestre 1',
        academicYear,
        title: 'Conseil de classe T1 — 6ème A',
        meetingDate: new Date('2025-12-18'),
        summary: 'Bilan globalement positif ; vigilance sur l’homogénéité des résultats.',
        decisions: 'Mise en place d’un tutorat maths pour 3 élèves.',
        createdById: admin1.id,
      },
      {
        classId: class2.id,
        period: 'Trimestre 2',
        academicYear,
        title: 'Conseil de classe T2 — 5ème B',
        meetingDate: new Date('2026-04-05'),
        summary: 'Progrès en français ; absences en hausse sur février.',
        recommendations: 'Relance parents sur l’assiduité.',
        createdById: admin1.id,
      },
    ],
  });

  // Bibliothèque
  console.log('📚 Création de la bibliothèque...');
  const book1 = await prisma.libraryBook.create({
    data: {
      isbn: '978-2-07-036822-8',
      title: 'Le Petit Prince',
      author: 'Antoine de Saint-Exupéry',
      publisher: 'Gallimard',
      publicationYear: 1946,
      category: 'Roman jeunesse',
      copiesTotal: 5,
      copiesAvailable: 3,
      shelfLocation: 'A-12',
    },
  });
  const book2 = await prisma.libraryBook.create({
    data: {
      isbn: '978-2-01-016810-8',
      title: 'Les Misérables (abrégé)',
      author: 'Victor Hugo',
      category: 'Classiques',
      copiesTotal: 3,
      copiesAvailable: 2,
      shelfLocation: 'B-04',
    },
  });
  await prisma.libraryBook.createMany({
    data: [
      {
        title: 'Cours de mathématiques 6ème',
        author: 'Collectif',
        category: 'Manuel',
        copiesTotal: 10,
        copiesAvailable: 7,
        shelfLocation: 'C-01',
      },
      {
        title: 'Atlas géographique',
        author: 'IGN Jeunesse',
        category: 'Référence',
        copiesTotal: 4,
        copiesAvailable: 4,
        shelfLocation: 'D-02',
      },
    ],
  });
  await prisma.libraryLoan.create({
    data: {
      bookId: book1.id,
      borrowerId: student1.id,
      status: 'ACTIVE',
      loanedAt: new Date('2026-04-28'),
      dueDate: new Date('2026-05-28'),
      createdById: admin1.id,
    },
  });
  await prisma.libraryReservation.create({
    data: {
      bookId: book2.id,
      userId: student2.id,
      status: 'PENDING',
      reservedAt: new Date('2026-05-12'),
      expiresAt: new Date('2026-05-26'),
    },
  });

  // E-learning
  console.log('💻 Création des parcours e-learning...');
  const eCourse = await prisma.elearningCourse.create({
    data: {
      title: 'Fractions — révision 6ème',
      description: 'Parcours interactif avant l’évaluation de mai.',
      subject: 'Mathématiques',
      level: '6ème',
      isPublished: true,
      teacherId: teacher1Profile!.id,
      classId: class1.id,
      courseId: course1.id,
    },
  });
  const lessonVideo = await prisma.elearningLesson.create({
    data: {
      elearningCourseId: eCourse.id,
      title: 'Vidéo — addition de fractions',
      kind: 'VIDEO',
      sortOrder: 1,
      externalUrl: 'https://example.com/videos/fractions-add',
      durationMinutes: 12,
      isPublished: true,
    },
  });
  const lessonQuiz = await prisma.elearningLesson.create({
    data: {
      elearningCourseId: eCourse.id,
      title: 'Quiz — fractions',
      kind: 'QUIZ',
      sortOrder: 2,
      isPublished: true,
    },
  });
  const quiz = await prisma.elearningQuiz.create({
    data: {
      lessonId: lessonQuiz.id,
      title: 'QCM fractions',
      passingScore: 60,
      autoGrade: true,
    },
  });
  await prisma.elearningQuizQuestion.createMany({
    data: [
      {
        quizId: quiz.id,
        kind: 'MCQ',
        prompt: '1/2 + 1/4 = ?',
        options: ['1/6', '3/4', '2/6', '1/8'],
        correctAnswer: '3/4',
        points: 2,
        sortOrder: 1,
      },
      {
        quizId: quiz.id,
        kind: 'TRUE_FALSE',
        prompt: 'Pour additionner des fractions, il faut le même dénominateur.',
        correctAnswer: 'true',
        points: 1,
        sortOrder: 2,
      },
    ],
  });
  await prisma.elearningLessonProgress.create({
    data: { lessonId: lessonVideo.id, studentId: student1Profile!.id },
  });
  await prisma.elearningQuizAttempt.create({
    data: {
      quizId: quiz.id,
      studentId: student1Profile!.id,
      answers: { q1: '3/4', q2: 'true' },
      score: 3,
      maxScore: 3,
      passed: true,
    },
  });
  await prisma.pedagogicalResourceBank.createMany({
    data: [
      {
        title: 'Fiche méthode — équations du 1er degré',
        kind: 'DOCUMENT',
        subject: 'Mathématiques',
        level: '5ème',
        externalUrl: 'https://example.com/docs/equations.pdf',
        tags: ['algèbre', 'fiche'],
        createdByTeacherId: teacher1Profile!.id,
      },
      {
        title: 'Carte mentale — Révolution française',
        kind: 'IMAGE',
        subject: 'Histoire',
        level: '6ème',
        tags: ['histoire', 'carte mentale'],
        createdByTeacherId: teacher3Profile!.id,
      },
    ],
  });
  await prisma.virtualClassSession.create({
    data: {
      title: 'Classe virtuelle — révision maths',
      description: 'Session live avant contrôle.',
      scheduledStart: new Date('2026-05-18T15:00:00'),
      durationMinutes: 45,
      status: 'SCHEDULED',
      meetingUrl: 'https://meet.example.com/math-6a-rev',
      teacherId: teacher1Profile!.id,
      elearningCourseId: eCourse.id,
      courseId: course1.id,
      classId: class1.id,
    },
  });

  // Santé & infirmerie
  console.log('🏥 Création des dossiers santé...');
  await prisma.studentHealthDossier.create({
    data: {
      studentId: student1Profile!.id,
      medicalHistory: 'Varicelle en 2018',
      familyDoctorName: 'Dr Martin',
      familyDoctorPhone: '+33 1 23 45 67 89',
      insuranceInfo: 'CMU — n° 123456',
      bloodGroup: 'O+',
    },
  });
  await prisma.studentAllergyRecord.createMany({
    data: [
      {
        studentId: student3Profile!.id,
        allergen: 'Arachides',
        severity: 'Élevée',
        reaction: 'Urticaire, risque anaphylaxie',
        notes: 'Épî pen en permanence au cartable',
      },
      {
        studentId: student8Profile!.id,
        allergen: 'Latex',
        severity: 'Modérée',
        reaction: 'Éruption cutanée',
      },
    ],
  });
  const healthCampaign = await prisma.healthCampaign.create({
    data: {
      kind: 'VACCINATION',
      title: 'Rappel DTP — 5ème et 6ème',
      description: 'Campagne de rappel vaccinal avec accord parental.',
      startDate: new Date('2026-05-15'),
      endDate: new Date('2026-05-30'),
      targetLevels: ['6ème', '5ème'],
      isActive: true,
    },
  });
  await prisma.healthCampaignParticipation.createMany({
    data: [
      { campaignId: healthCampaign.id, studentId: student1Profile!.id, status: 'COMPLETED', completedAt: new Date('2026-05-16') },
      { campaignId: healthCampaign.id, studentId: student4Profile!.id, status: 'SCHEDULED' },
    ],
  });
  await prisma.infirmaryVisit.createMany({
    data: [
      {
        studentId: student2Profile!.id,
        staffMemberId: nurseStaff?.id,
        visitedAt: new Date('2026-05-11T10:30:00'),
        motive: 'Maux de tête',
        careAdministered: 'Repos 20 min, hydratation',
        outcome: 'RETURN_TO_CLASS',
        parentNotified: true,
      },
      {
        studentId: student7Profile!.id,
        staffMemberId: nurseStaff?.id,
        visitedAt: new Date('2026-05-09T14:15:00'),
        motive: 'Chute dans la cour — genou',
        careAdministered: 'Glace, pansement',
        outcome: 'REST_INFIRMARY',
        parentNotified: true,
        notes: 'Surveillance 1 h',
      },
    ],
  });

  // Fiches de poste & pointages staff
  console.log('📋 Fiches de poste et présences staff...');
  const jobSecretary = await prisma.jobDescription.create({
    data: {
      title: 'Secrétaire de direction',
      code: 'JD-SECRETARY',
      summary: 'Accueil, courrier, dossiers élèves et coordination.',
      responsibilities: 'Gestion agenda direction, archivage, accueil familles, coordination rendez-vous.',
      isActive: true,
    },
  });
  await prisma.jobDescription.create({
    data: {
      title: 'Infirmier(ère) scolaire',
      code: 'JD-NURSE',
      summary: 'Soins de première intention et prévention.',
      responsibilities: 'Accueil élèves malades, carnet de liaison, campagnes de prévention.',
      isActive: true,
    },
  });
  if (secretaryStaff) {
    await prisma.staffMember.update({
      where: { id: secretaryStaff.id },
      data: { jobDescriptionId: jobSecretary.id },
    });
  }
  await prisma.staffAttendance.createMany({
    data: [
      {
        staffId: secretaryStaff!.id,
        attendanceDate: '2026-05-12',
        checkInAt: new Date('2026-05-12T07:55:00'),
        checkOutAt: new Date('2026-05-12T17:10:00'),
        status: 'PRESENT',
      },
      {
        staffId: nurseStaff!.id,
        attendanceDate: '2026-05-12',
        checkInAt: new Date('2026-05-12T08:00:00'),
        status: 'PRESENT',
      },
    ],
  });

  // Activités parascolaires
  console.log('⚽ Création des activités parascolaires...');
  const clubFoot = await prisma.extracurricularOffering.create({
    data: {
      kind: 'CLUB',
      category: 'SPORT_COMPETITION',
      title: 'Club football',
      description: 'Entraînements mercredi après-midi',
      maxParticipants: 22,
      academicYear,
      isActive: true,
      isPublished: true,
      meetSchedule: 'Mercredi 14 h – 16 h',
      createdById: admin1.id,
    },
  });
  await prisma.extracurricularOffering.create({
    data: {
      kind: 'CLUB',
      category: 'ARTS_CULTURE',
      title: 'Atelier théâtre',
      description: 'Préparation spectacle de fin d’année',
      maxParticipants: 15,
      academicYear,
      isActive: true,
      isPublished: true,
      createdById: admin1.id,
    },
  });
  await prisma.extracurricularRegistration.createMany({
    data: [
      { offeringId: clubFoot.id, studentId: student1Profile!.id, status: 'CONFIRMED' },
      { offeringId: clubFoot.id, studentId: student7Profile!.id, status: 'CONFIRMED' },
      { offeringId: clubFoot.id, studentId: student5Profile!.id, status: 'PENDING' },
    ],
  });

  console.log('✅ Seed terminé avec succès !');
  console.log('\n📊 Résumé des données créées :');
  console.log(`   - 1 Super administrateur (superadmin@tranlefet.ci / password123)`);
  console.log(`   - 1 Administrateur (admin@school.com / password123)`);
  console.log(`   - 3 Enseignants (teacher1@school.com … / password123)`);
  console.log(`   - 9 Élèves (student1@school.com … student9@school.com / password123)`);
  console.log(`   - 2 Parents (parent1@school.com, parent2@school.com / password123)`);
  console.log(`   - 3 Comptes STAFF soutien (secretary@, bursar@, studies@school.com / password123)`);
  console.log(`   - 3 STAFF suppl. (nurse@, librarian@, accountant@school.com / password123)`);
  console.log(`   - 5 Admissions (statuts variés)`);
  console.log(`   - 4 Rendez-vous parents–enseignants`);
  console.log(`   - Frais de scolarité, catalogue, gabarit et paiements`);
  console.log(`   - 3 Annonces + 2 événements calendrier`);
  console.log(`   - 2 Conseils de classe`);
  console.log(`   - 4 Ouvrages bibliothèque + prêt + réservation`);
  console.log(`   - Parcours e-learning (cours, quiz, classe virtuelle, ressources)`);
  console.log(`   - Dossiers santé, allergies, campagne vaccin, visites infirmerie`);
  console.log(`   - 2 Fiches de poste + pointages staff`);
  console.log(`   - 2 Activités parascolaires + inscriptions`);
  console.log(`   - 2 Classes (6ème A : 5 élèves, 5ème B : 4 élèves)`);
  console.log(`   - 5 Cours (3 en 6ème A, 2 en 5ème B)`);
  console.log(`   - Nombreuses notes sur sept. 2025 – mai 2026 (graphiques admin / élève)`);
  console.log(`   - 8 Absences réparties sur plusieurs mois`);
  console.log(`   - 4 Devoirs + remises pour tous les élèves`);
  console.log(`   - 6 Entrées d'emploi du temps (6ème A)`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

