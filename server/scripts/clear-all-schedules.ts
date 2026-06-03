/**
 * Supprime tous les emplois du temps de classe et créneaux associés :
 * - schedules (grille EDT)
 * - teacher_schedule_availability_slots (disponibilités RDV parents)
 * - room_schedule_unavailable_slots (indisponibilités salles)
 */
import dotenv from 'dotenv';
import prisma from '../src/utils/prisma';

dotenv.config();

async function main() {
  const [absencesCleared, teacherAttCleared, schedules, avail, roomBlocks] =
    await prisma.$transaction([
      prisma.absence.updateMany({
        where: { scheduleId: { not: null } },
        data: { scheduleId: null },
      }),
      prisma.teacherAttendance.updateMany({
        where: { scheduleId: { not: null } },
        data: { scheduleId: null },
      }),
      prisma.schedule.deleteMany({}),
      prisma.teacherScheduleAvailabilitySlot.deleteMany({}),
      prisma.roomScheduleUnavailableSlot.deleteMany({}),
    ]);

  console.log('Emplois du temps supprimés:', schedules.count);
  console.log('Disponibilités enseignants supprimées:', avail.count);
  console.log('Indisponibilités salles supprimées:', roomBlocks.count);
  console.log('Références scheduleId effacées — absences:', absencesCleared.count);
  console.log('Références scheduleId effacées — pointages prof:', teacherAttCleared.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
