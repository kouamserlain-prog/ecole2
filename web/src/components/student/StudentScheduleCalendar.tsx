import { useState, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { FiClock, FiMapPin, FiUser, FiCalendar, FiDownload } from 'react-icons/fi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

interface ScheduleItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  course: {
    name: string;
    teacher: {
      user: {
        firstName: string;
        lastName: string;
      };
    };
  };
  room?: string;
}

interface StudentScheduleCalendarProps {
  schedule: ScheduleItem[];
}

const DAYS = [
  { value: 0, label: 'Dimanche', short: 'Dim' },
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
];

import {
  SCHEDULE_TIME_SLOTS,
  formatScheduleGridTimeLabel,
  planScheduleGridCell,
} from '../../lib/scheduleTimeSlots';

const StudentScheduleCalendar: React.FC<StudentScheduleCalendarProps> = ({ schedule }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'weekly'>('weekly');

  const getDaySchedule = (date: Date) => {
    const dayOfWeek = date.getDay();
    return schedule.filter((item) => item.dayOfWeek === dayOfWeek);
  };

  const daySchedule = getDaySchedule(selectedDate);

  // Organiser l'emploi du temps par jour de la semaine
  const weeklySchedule = useMemo(() => {
    const organized: { [key: number]: ScheduleItem[] } = {};
    DAYS.forEach((day) => {
      organized[day.value] = schedule.filter((item) => item.dayOfWeek === day.value);
    });
    return organized;
  }, [schedule]);

  // Fonction d'export PDF
  const exportToPDF = () => {
    if (!schedule || schedule.length === 0) {
      toast.error('Aucun emploi du temps à exporter');
      return;
    }

    try {
      const doc = new jsPDF('l', 'mm', 'a4'); // Landscape pour un meilleur affichage
      const currentDate = new Date().toLocaleDateString('fr-FR');

      // Header
      doc.setFillColor(139, 92, 246);
      doc.roundedRect(14, 10, 40, 12, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SM', 34, 18, { align: 'center' });
      
      doc.setTextColor(139, 92, 246);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('School Manager', 60, 18);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text('Emploi du Temps', 60, 25);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${currentDate}`, 60, 30);

      // Organiser les cours par jour
      const scheduleByDay: Record<number, ScheduleItem[]> = {};
      DAYS.forEach(day => {
        scheduleByDay[day.value] = schedule.filter((s: ScheduleItem) => s.dayOfWeek === day.value);
      });

      // Créer les données du tableau
      const tableData: any[][] = [];
      
      // Trouver le nombre maximum de cours par jour
      const maxCoursesPerDay = Math.max(...Object.values(scheduleByDay).map(daySchedule => daySchedule.length));

      // Créer les lignes pour chaque créneau
      for (let i = 0; i < maxCoursesPerDay; i++) {
        const row: any[] = [];
        DAYS.forEach(day => {
          const daySchedule = scheduleByDay[day.value] || [];
          if (daySchedule[i]) {
            const course = daySchedule[i];
            const timeRange = `${course.startTime} - ${course.endTime}`;
            const courseInfo = `${course.course.name}\n${course.course.teacher.user.firstName} ${course.course.teacher.user.lastName}\n${timeRange}${course.room ? `\nSalle: ${course.room}` : ''}`;
            row.push(courseInfo);
          } else {
            row.push('');
          }
        });
        tableData.push(row);
      }

      // En-têtes des colonnes (jours de la semaine)
      const headers = DAYS.map(day => day.label);

      const useAutoTable = (options: any) => {
        if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable(options);
        } else if (typeof autoTable === 'function') {
          autoTable(doc, options);
        } else {
          throw new Error('autoTable is not available');
        }
      };

      useAutoTable({
        startY: 38,
        head: [headers],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [139, 92, 246], 
          textColor: 255, 
          fontStyle: 'bold',
          fontSize: 10
        },
        styles: { 
          fontSize: 8, 
          cellPadding: 3,
          lineWidth: 0.1,
          lineColor: [200, 200, 200]
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 35 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
          4: { cellWidth: 35 },
          5: { cellWidth: 35 },
          6: { cellWidth: 35 },
        },
        margin: { left: 14, right: 14, top: 38 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      doc.save(`emploi-du-temps-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Emploi du temps exporté en PDF avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de l\'export PDF:', error);
      toast.error('Erreur lors de l\'export PDF');
    }
  };

  const tileContent = ({ date }: { date: Date }) => {
    const daySchedule = getDaySchedule(date);
    if (daySchedule.length > 0) {
      return (
        <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
          {daySchedule.slice(0, 2).map((item, idx) => (
            <div
              key={idx}
              className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-sm transform-gpu transition-transform duration-200 hover:scale-125"
              title={item.course.name}
              style={{
                boxShadow: '0 2px 4px rgba(147, 51, 234, 0.3)',
              }}
            />
          ))}
          {daySchedule.length > 2 && (
            <div 
              className="h-1.5 w-1.5 rounded-full bg-gray-400" 
              title={`+${daySchedule.length - 2} autres`}
              style={{
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }}
            />
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 text-sm">
      {/* Header avec bouton d'export */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Mon Emploi du Temps</h2>
            <p className="text-xs text-gray-600">Visualisez et téléchargez votre emploi du temps</p>
          </div>
          <Button
            onClick={exportToPDF}
            variant="primary"
            size="sm"
          >
            <FiDownload className="w-4 h-4 mr-2" />
            Télécharger PDF
          </Button>
        </div>
      </Card>
      {/* Mode Toggle */}
      <Card className="relative overflow-hidden group perspective-3d transform-gpu transition-all duration-300 hover:shadow-2xl"
        style={{
          transform: 'translateZ(0)',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-600">Choisissez votre mode d&apos;affichage</p>
          </div>
          <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-xl p-1 border-2 border-purple-200 shadow-lg"
            style={{
              boxShadow: '0 4px 12px rgba(147, 51, 234, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
            }}
          >
            <button
              onClick={() => setViewMode('weekly')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300 transform-gpu ${
                viewMode === 'weekly'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              style={{
                boxShadow: viewMode === 'weekly' ? '0 4px 12px rgba(147, 51, 234, 0.4)' : 'none',
              }}
            >
              <FiCalendar className="w-4 h-4 inline mr-2" />
              Hebdomadaire
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300 transform-gpu ${
                viewMode === 'calendar'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              style={{
                boxShadow: viewMode === 'calendar' ? '0 4px 12px rgba(147, 51, 234, 0.4)' : 'none',
              }}
            >
              <FiCalendar className="w-4 h-4 inline mr-2" />
              Calendrier
            </button>
          </div>
        </div>
      </Card>

      {viewMode === 'weekly' ? (
        <Card 
          className="relative overflow-hidden group perspective-3d transform-gpu transition-all duration-300 hover:shadow-2xl"
          style={{
            transform: 'translateZ(0)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Effet 3D de fond animé */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          {/* Ombres 3D */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(147, 51, 234, 0.1) 0%, transparent 70%)',
              transform: 'translateZ(-30px)',
              filter: 'blur(30px)',
            }}
          ></div>
          
          <div className="relative z-10">
            <h3 
              className="relative mb-4 text-lg font-bold text-gray-800"
              style={{
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                transform: 'perspective(300px) translateZ(10px)',
              }}
            >
              Planning Hebdomadaire
            </h3>

            {/* Weekly Schedule Grid — précision minute */}
            <div className="max-h-[min(70vh,720px)] overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th 
                      className="relative min-w-[88px] border border-gray-200 bg-gradient-to-br from-purple-100 to-pink-100 px-2 py-1.5 text-[11px] font-semibold text-gray-700 sm:text-xs"
                      style={{
                        boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 0 rgba(255, 255, 255, 0.5)',
                        transform: 'perspective(200px) rotateX(5deg)',
                      }}
                    >
                      Heure
                    </th>
                    {DAYS.slice(1, 6).map((day) => (
                      <th
                        key={day.value}
                        className="relative min-w-[118px] border border-gray-200 bg-gradient-to-br from-purple-100 to-pink-100 px-2 py-1.5 text-[11px] font-semibold text-gray-700 sm:min-w-[128px] sm:text-xs"
                        style={{
                          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 0 rgba(255, 255, 255, 0.5)',
                          transform: 'perspective(200px) rotateX(5deg)',
                        }}
                      >
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const weekDays = DAYS.slice(1, 6);
                    const occupiedByDay: Record<number, number> = {};
                    return SCHEDULE_TIME_SLOTS.map((time) => {
                      const dayCells = weekDays.map((day) => {
                        const daySlots = weeklySchedule[day.value] ?? [];
                        const occupied = occupiedByDay[day.value] ?? 0;
                        const { plan, nextOccupiedUntil } = planScheduleGridCell(
                          daySlots,
                          time,
                          occupied
                        );
                        occupiedByDay[day.value] = nextOccupiedUntil;
                        return { day, plan };
                      });

                      if (!dayCells.some((c) => c.plan.type !== 'skip')) return null;

                      return (
                      <tr key={time} className="h-4">
                        <td 
                          className="relative border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 px-1 py-0 text-[10px] font-medium text-gray-600 tabular-nums whitespace-nowrap"
                          style={{
                            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          {formatScheduleGridTimeLabel(time)}
                        </td>
                        {dayCells.map(({ day, plan }) => {
                          if (plan.type === 'skip') return null;
                          if (plan.type === 'empty') {
                            return (
                              <td key={day.value} className="border border-gray-200 p-0 h-4" />
                            );
                          }
                          const scheduleForSlot = plan.slot as ScheduleItem;

                          return (
                            <td
                              key={day.value}
                              rowSpan={plan.rowSpan}
                              className="border border-gray-200 p-1 align-top sm:p-1.5"
                            >
                              {scheduleForSlot ? (
                                <div 
                                  className="relative mb-1 cursor-pointer rounded-lg border-2 border-purple-300 bg-gradient-to-br from-purple-100 via-pink-50 to-purple-50 p-1.5 transform-gpu transition-all duration-300 group/course hover:scale-[1.02] hover:shadow-xl sm:p-2"
                                  style={{
                                    boxShadow: '0 4px 12px rgba(147, 51, 234, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                                    transform: 'perspective(500px) translateZ(0) rotateX(2deg)',
                                    transformStyle: 'preserve-3d',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'perspective(500px) translateZ(15px) rotateX(0deg) scale(1.02)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'perspective(500px) translateZ(0) rotateX(2deg) scale(1)';
                                  }}
                                >
                                  {/* Effet de brillance 3D */}
                                  <div 
                                    className="absolute inset-0 opacity-0 group-hover/course:opacity-100 transition-opacity duration-300 rounded-lg"
                                    style={{
                                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%)',
                                      mixBlendMode: 'overlay',
                                    }}
                                  ></div>
                                  
                                  {/* Ombres 3D au survol */}
                                  <div 
                                    className="absolute inset-0 opacity-0 group-hover/course:opacity-100 transition-opacity duration-300 rounded-lg"
                                    style={{
                                      background: 'radial-gradient(ellipse at 30% 30%, rgba(147, 51, 234, 0.2) 0%, transparent 70%)',
                                      transform: 'translateZ(-10px)',
                                      filter: 'blur(10px)',
                                    }}
                                  ></div>
                                  
                                  <div className="relative z-10">
                                    <p 
                                      className="relative mb-0.5 text-xs font-bold leading-snug text-gray-800 sm:text-[13px]"
                                      style={{
                                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                        transform: 'translateZ(5px)',
                                      }}
                                    >
                                      {scheduleForSlot.course?.name}
                                    </p>
                                    <div className="mb-0.5 flex items-center text-[11px] text-gray-600">
                                      <FiUser className="mr-0.5 h-2.5 w-2.5 shrink-0" />
                                      {scheduleForSlot.course?.teacher?.user?.firstName}{' '}
                                      {scheduleForSlot.course?.teacher?.user?.lastName}
                                    </div>
                                    {scheduleForSlot.room && (
                                      <div className="mb-0.5 flex items-center text-[10px] text-gray-500">
                                        <FiMapPin className="mr-0.5 h-2.5 w-2.5 shrink-0" />
                                        {scheduleForSlot.room}
                                      </div>
                                    )}
                                    <div className="flex items-center text-[10px] font-semibold text-purple-600">
                                      <FiClock className="mr-0.5 h-2.5 w-2.5 shrink-0" />
                                      {scheduleForSlot.startTime} - {scheduleForSlot.endTime}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card 
            className="lg:col-span-2 relative overflow-hidden group perspective-3d transform-gpu transition-all duration-300 hover:shadow-2xl"
            style={{
              transform: 'translateZ(0)',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <h3 
                className="relative mb-3 text-base font-bold text-gray-800"
                style={{
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  transform: 'perspective(300px) translateZ(10px)',
                }}
              >
                Calendrier
              </h3>
              <div className="custom-calendar mx-auto w-full max-w-[16.5rem] sm:max-w-[17rem]">
                <Calendar
                  onChange={(v) => {
                    if (v instanceof Date) setSelectedDate(v);
                  }}
                  value={selectedDate}
                  tileContent={tileContent}
                  className="w-full rounded-lg border-0 text-[11px] leading-tight"
                />
              </div>
            </div>
          </Card>

          <Card 
            className="relative overflow-hidden group perspective-3d transform-gpu transition-all duration-300 hover:shadow-2xl"
            style={{
              transform: 'translateZ(0)',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <h3 
                className="relative mb-3 text-base font-bold text-gray-800"
                style={{
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  transform: 'perspective(300px) translateZ(10px)',
                }}
              >
                {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
              </h3>
              {daySchedule.length > 0 ? (
                <div className="space-y-3">
                  {daySchedule
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((item) => (
                      <div
                        key={item.id}
                        className="relative group/course p-4 bg-gradient-to-br from-purple-100 via-pink-50 to-purple-50 rounded-lg border-2 border-purple-300 transform-gpu transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer"
                        style={{
                          boxShadow: '0 4px 12px rgba(147, 51, 234, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                          transform: 'perspective(500px) translateZ(0) rotateX(2deg)',
                          transformStyle: 'preserve-3d',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'perspective(500px) translateZ(15px) rotateX(0deg) scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'perspective(500px) translateZ(0) rotateX(2deg) scale(1)';
                        }}
                      >
                        {/* Effet de brillance 3D */}
                        <div 
                          className="absolute inset-0 opacity-0 group-hover/course:opacity-100 transition-opacity duration-300 rounded-lg"
                          style={{
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%)',
                            mixBlendMode: 'overlay',
                          }}
                        ></div>
                        
                        <div className="relative z-10">
                          <div className="flex justify-between items-start mb-2">
                            <h4 
                              className="font-bold text-gray-900 relative"
                              style={{
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                transform: 'translateZ(5px)',
                              }}
                            >
                              {item.course.name}
                            </h4>
                            <Badge 
                              variant="info" 
                              size="sm"
                              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform-gpu transition-transform duration-300 hover:scale-110"
                              style={{
                                boxShadow: '0 2px 8px rgba(147, 51, 234, 0.4)',
                              }}
                            >
                              {item.startTime} - {item.endTime}
                            </Badge>
                          </div>
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <FiUser className="w-4 h-4 mr-1" />
                            {item.course.teacher.user.firstName} {item.course.teacher.user.lastName}
                          </div>
                          {item.room && (
                            <div className="flex items-center text-xs text-gray-500 mt-1">
                              <FiMapPin className="w-3 h-3 mr-1" />
                              Salle: {item.room}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FiCalendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Aucun cours prévu ce jour</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Styles CSS pour les effets 3D */}
      <style>{`
        @keyframes float3d {
          0%, 100% {
            transform: translateY(0px) translateZ(0);
          }
          50% {
            transform: translateY(-10px) translateZ(10px);
          }
        }
        
        .perspective-3d {
          perspective: 1000px;
        }
        
        .transform-gpu {
          transform: translateZ(0);
          will-change: transform;
          backface-visibility: hidden;
        }
        
        .custom-calendar .react-calendar {
          border: none;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(147, 51, 234, 0.08);
          font-size: 0.6875rem;
        }
        
        .custom-calendar .react-calendar__navigation__label {
          font-size: 0.75rem !important;
        }
        
        .custom-calendar .react-calendar__tile {
          border-radius: 6px;
          padding: 0.2rem 0.1rem;
          min-height: 1.55rem;
          font-size: 0.625rem;
          transition: all 0.2s;
        }
        
        .custom-calendar .react-calendar__tile:hover {
          background: linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(236, 72, 153, 0.1));
          transform: scale(1.02);
        }
        
        .custom-calendar .react-calendar__tile--active {
          background: linear-gradient(135deg, #9333ea, #ec4899);
          color: white;
          box-shadow: 0 2px 8px rgba(147, 51, 234, 0.35);
        }
      `}</style>
    </div>
  );
};

export default StudentScheduleCalendar;

