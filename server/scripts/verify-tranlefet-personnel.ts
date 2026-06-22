import dotenv from 'dotenv';
import prisma from '../src/utils/prisma';

dotenv.config();

const checks = [
  'kouamesergealain@live.fr',
  'nguessanamelaapolline@gmail.com',
  'joselinemariefodio@gmail.com',
  'kouamserlain@gmail.com',
  'jonathanavril603@gmail.com',
];

async function main() {
  for (const email of checks) {
    const u = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        teacherProfile: { select: { specialization: true, employeeId: true } },
        staffProfile: { select: { jobTitle: true, supportKind: true, employeeId: true } },
        studentProfile: { select: { studentId: true, classId: true, schoolId: true } },
        educatorProfile: { select: { specialization: true, employeeId: true } },
      },
    });
    console.log(u ? JSON.stringify(u) : `NOT FOUND: ${email}`);
  }
  console.log('counts:', {
    teachers: await prisma.teacher.count(),
    staff: await prisma.staffMember.count(),
    students: await prisma.student.count(),
    educators: await prisma.educator.count(),
  });
}

main().finally(() => prisma.$disconnect());
