import { validationError } from './errors';

/*
 * Serverseitige Eingabeprüfung. Das Frontend validiert ebenfalls, aber nur
 * diese Prüfungen sind verlässlich – Resolver-Payloads können manipuliert werden.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMERIC_ID_PATTERN = /^\d{1,20}$/;
// Atlassian-accountIds: z. B. "5b10ac8d82e05b22cc7d4ef5" oder "712020:2c4f…"
const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;
const MS_PER_DAY = 86400000;

/** Maximale Anzahl Mitglieder pro Team. */
export const MAX_TEAM_MEMBERS = 100;

/**
 * Prüft eine numerische Datensatz-ID und liefert sie als String.
 * @param {unknown} value
 * @param {string} label Bezeichnung für die Fehlermeldung
 * @returns {string}
 */
export const requireId = (value, label) => {
  const id = String(value ?? '');
  if (!NUMERIC_ID_PATTERN.test(id)) throw validationError(`${label} ist ungültig.`);
  return id;
};

/**
 * Prüft ein Datum im Format YYYY-MM-DD inkl. Kalendergültigkeit (kein 31.02.).
 * @param {unknown} value
 * @param {string} label
 * @returns {string}
 */
export const requireDate = (value, label) => {
  const isValidFormat = typeof value === 'string' && ISO_DATE_PATTERN.test(value);
  const isRealDate = isValidFormat && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
  if (!isRealDate) throw validationError(`${label} ist kein gültiges Datum.`);
  return value;
};

/**
 * Prüft einen Datumsbereich: beide Daten gültig, Ende >= Start, maximale Länge.
 * @param {unknown} start
 * @param {unknown} end
 * @param {number} maxDays Maximale Länge in Kalendertagen
 * @returns {{startDate: string, endDate: string}}
 */
export const requireDateRange = (start, end, maxDays) => {
  const startDate = requireDate(start, 'Das Startdatum');
  const endDate = requireDate(end, 'Das Enddatum');
  if (endDate < startDate) throw validationError('Das Enddatum darf nicht vor dem Startdatum liegen.');
  const lengthInDays = (Date.parse(endDate) - Date.parse(startDate)) / MS_PER_DAY + 1;
  if (lengthInDays > maxDays) throw validationError(`Der Zeitraum darf höchstens ${maxDays} Tage umfassen.`);
  return { startDate, endDate };
};

/**
 * Prüft einen optionalen Freitext; leere Eingaben werden zu null.
 * @param {unknown} value
 * @param {number} maxLength
 * @param {string} label
 * @returns {string|null}
 */
export const optionalText = (value, maxLength, label) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw validationError(`${label} ist ungültig.`);
  const text = value.trim();
  if (text.length > maxLength) throw validationError(`${label} darf höchstens ${maxLength} Zeichen lang sein.`);
  return text || null;
};

/**
 * Prüft einen Pflicht-Namen (getrimmt, 1–100 Zeichen).
 * @param {unknown} value
 * @returns {string}
 */
export const requireTeamName = (value) => {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length === 0) throw validationError('Bitte einen Teamnamen angeben.');
  if (name.length > 100) throw validationError('Der Teamname darf höchstens 100 Zeichen lang sein.');
  return name;
};

/**
 * Prüft eine Liste von accountIds und entfernt Duplikate.
 * @param {unknown} value
 * @returns {string[]}
 */
export const requireAccountIds = (value) => {
  if (!Array.isArray(value)) throw validationError('Die Mitgliederliste ist ungültig.');
  if (value.some((id) => typeof id !== 'string' || !ACCOUNT_ID_PATTERN.test(id))) {
    throw validationError('Die Mitgliederliste enthält ungültige Einträge.');
  }
  const unique = [...new Set(value)];
  if (unique.length > MAX_TEAM_MEMBERS) throw validationError(`Ein Team darf höchstens ${MAX_TEAM_MEMBERS} Mitglieder haben.`);
  return unique;
};
