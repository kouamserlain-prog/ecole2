/** Modèle CSV pour l’import d’emploi du temps (séparateur ;). */
export const SCHEDULE_IMPORT_CSV_TEMPLATE = `Classe;Jour;Heure début;Heure fin;Matière;Code matière;Salle
6ème A;Lundi;08:00;09:00;Mathématiques;;Salle 101
6ème A;Mardi;10:00;11:00;Français;;Salle 102`;

export function downloadScheduleImportTemplate() {
  const blob = new Blob(['\ufeff', SCHEDULE_IMPORT_CSV_TEMPLATE], {
    type: 'text/csv;charset=utf-8',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'modele-emploi-du-temps.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export async function readCsvFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'UTF-8');
  });
}
