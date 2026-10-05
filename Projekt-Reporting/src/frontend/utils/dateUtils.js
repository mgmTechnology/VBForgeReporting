/**
 * Datums-Hilfsfunktionen für die Urlaubsplanung.
 *
 * Alle Datumswerte werden als ISO-String 'YYYY-MM-DD' geführt (so liefert sie
 * auch der UI-Kit-DatePicker). ISO-Strings lassen sich direkt per < / > vergleichen.
 */

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
  'August', 'September', 'Oktober', 'November', 'Dezember'];

/**
 * Wandelt einen ISO-String in ein lokales Date (ohne Zeitzonen-Verschiebung).
 * @param {string} iso Datum als 'YYYY-MM-DD'
 * @returns {Date}
 */
export const parseIso = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Wandelt ein Date in einen ISO-String 'YYYY-MM-DD'.
 * @param {Date} date
 * @returns {string}
 */
export const toIso = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Formatiert einen ISO-String deutsch, z. B. '19.10.2026'.
 * @param {string} iso
 * @param {boolean} [withYear=true] Jahr mit ausgeben
 * @returns {string}
 */
export const formatDate = (iso, withYear = true) => {
  const [year, month, day] = iso.split('-');
  return withYear ? `${day}.${month}.${year}` : `${day}.${month}.`;
};

/**
 * Formatiert einen Zeitraum, z. B. '19.10.2026 – 23.10.2026'.
 * @param {string} startIso
 * @param {string} endIso
 * @returns {string}
 */
export const formatRange = (startIso, endIso) => `${formatDate(startIso)} – ${formatDate(endIso)}`;

/**
 * Zählt die Arbeitstage (Mo–Fr) zwischen zwei Daten inklusive. Feiertage werden
 * (noch) nicht berücksichtigt.
 * @param {string} startIso
 * @param {string} endIso
 * @returns {number}
 */
export const countWorkdays = (startIso, endIso) => {
  let count = 0;
  for (let day = parseIso(startIso); day <= parseIso(endIso); day.setDate(day.getDate() + 1)) {
    const weekday = day.getDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
};

/**
 * Prüft, ob ein Urlaub einen Zeitraum berührt.
 * @param {{startDate: string, endDate: string}} vacation
 * @param {string} fromIso
 * @param {string} toIso_
 * @returns {boolean}
 */
export const overlaps = (vacation, fromIso, toIso_) =>
  vacation.startDate <= toIso_ && vacation.endDate >= fromIso;

/**
 * Liefert die ISO-Kalenderwoche eines Datums.
 * @param {Date} date
 * @returns {number}
 */
export const getIsoWeek = (date) => {
  // Donnerstag der gleichen Woche bestimmt das Jahr der KW (ISO 8601)
  const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  return 1 + Math.round(((thursday - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
};

/**
 * Liefert alle Wochen (Montag–Freitag), die einen Monat berühren.
 * @param {number} year
 * @param {number} month Monat 0–11
 * @returns {Array<{week: number, from: string, to: string}>}
 */
export const getWeeksOfMonth = (year, month) => {
  const weeks = [];
  const firstDay = new Date(year, month, 1);
  // Auf den Montag der ersten Woche zurückspringen
  const monday = new Date(year, month, 1 - ((firstDay.getDay() + 6) % 7));
  while (monday.getMonth() === month || monday < firstDay) {
    const friday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4);
    weeks.push({ week: getIsoWeek(monday), from: toIso(monday), to: toIso(friday) });
    monday.setDate(monday.getDate() + 7);
  }
  return weeks;
};

/**
 * Formatiert einen Monat, z. B. 'Oktober 2026'.
 * @param {number} year
 * @param {number} month Monat 0–11
 * @returns {string}
 */
export const formatMonth = (year, month) => `${MONTH_NAMES[month]} ${year}`;
