import { execute } from './db/sqlClient';
import { notFoundError, validationError } from './errors';
import { requireTeamMembership } from './teamService';
import { optionalText, requireDateRange, requireId } from './validation';

/*
 * Geschäftslogik für Urlaube.
 * Regeln: Jeder User verwaltet nur seine eigenen Urlaube. Urlaube anderer
 * sieht man nur über ein Team, in dem man selbst Mitglied ist.
 */

/** Maximale Länge eines einzelnen Urlaubs in Kalendertagen. */
const MAX_VACATION_DAYS = 366;
/** Maximale Länge des Abfragezeitraums für die Teamansicht. */
const MAX_QUERY_DAYS = 100;
const MAX_COMMENT_LENGTH = 500;

// DATE_FORMAT liefert die Daten als 'YYYY-MM-DD' – genau das Format des DatePickers
const VACATION_COLUMNS = `
  v.id, v.account_id AS accountId,
  DATE_FORMAT(v.start_date, '%Y-%m-%d') AS startDate,
  DATE_FORMAT(v.end_date, '%Y-%m-%d') AS endDate,
  v.comment`;

const SELECT_UPCOMING_FOR_USER = `
  SELECT ${VACATION_COLUMNS} FROM vacation v
  WHERE v.account_id = ? AND v.end_date >= CURDATE()
  ORDER BY v.start_date`;

const SELECT_FOR_TEAM_IN_RANGE = `
  SELECT ${VACATION_COLUMNS} FROM vacation v
  WHERE v.account_id IN (SELECT tm.account_id FROM team_member tm WHERE tm.team_id = ?)
    AND v.start_date <= ? AND v.end_date >= ?
  ORDER BY v.start_date`;

// Überschneidung mit eigenen Urlauben (der bearbeitete Urlaub selbst zählt nicht)
const SELECT_OWN_OVERLAP = `
  SELECT 1 AS found FROM vacation
  WHERE account_id = ? AND start_date <= ? AND end_date >= ? AND id <> ?
  LIMIT 1`;

/**
 * Wandelt eine DB-Zeile in das Format für das Frontend.
 * @param {object} row
 * @returns {{id: string, accountId: string, startDate: string, endDate: string, comment: string|null}}
 */
const toVacation = (row) => ({
  id: String(row.id), accountId: row.accountId, startDate: row.startDate, endDate: row.endDate, comment: row.comment,
});

/**
 * Prüft und normalisiert die Eingaben eines Urlaubs.
 * @param {object} input
 * @returns {{startDate: string, endDate: string, comment: string|null}}
 */
const parseVacationInput = (input) => ({
  ...requireDateRange(input.startDate, input.endDate, MAX_VACATION_DAYS),
  comment: optionalText(input.comment, MAX_COMMENT_LENGTH, 'Der Kommentar'),
});

/**
 * Verhindert, dass sich eigene Urlaube überschneiden.
 * @param {string} accountId
 * @param {{startDate: string, endDate: string}} vacation
 * @param {string} excludeId ID des bearbeiteten Urlaubs ('0' beim Anlegen)
 * @returns {Promise<void>}
 */
const requireNoOverlap = async (accountId, { startDate, endDate }, excludeId) => {
  const rows = await execute(SELECT_OWN_OVERLAP, accountId, endDate, startDate, excludeId);
  if (rows.length > 0) throw validationError('Der Zeitraum überschneidet sich mit einem bereits eingetragenen Urlaub.');
};

/**
 * Prüft, dass der Urlaub existiert und dem Aufrufer gehört.
 * @param {string} vacationId
 * @param {string} accountId
 * @returns {Promise<void>}
 */
const requireOwnVacation = async (vacationId, accountId) => {
  const rows = await execute('SELECT 1 AS found FROM vacation WHERE id = ? AND account_id = ?', vacationId, accountId);
  if (rows.length === 0) throw notFoundError('Der Urlaub wurde nicht gefunden.');
};

/**
 * Liefert die eigenen aktuellen und künftigen Urlaube.
 * @param {string} accountId Aufrufer
 * @returns {Promise<Array<object>>}
 */
export const listUpcomingVacations = async (accountId) =>
  (await execute(SELECT_UPCOMING_FOR_USER, accountId)).map(toVacation);

/**
 * Liefert alle Urlaube der Mitglieder eines Teams, die einen Zeitraum berühren.
 * Nur für Mitglieder des Teams erlaubt.
 * @param {string} accountId Aufrufer
 * @param {{teamId: string, from: string, to: string}} input
 * @returns {Promise<Array<object>>}
 */
export const listTeamVacations = async (accountId, input) => {
  const teamId = requireId(input.teamId, 'Die Team-ID');
  const { startDate: from, endDate: to } = requireDateRange(input.from, input.to, MAX_QUERY_DAYS);
  await requireTeamMembership(teamId, accountId);
  return (await execute(SELECT_FOR_TEAM_IN_RANGE, teamId, to, from)).map(toVacation);
};

/**
 * Trägt einen eigenen Urlaub ein.
 * @param {string} accountId Aufrufer
 * @param {{startDate: string, endDate: string, comment?: string}} input
 * @returns {Promise<{id: string}>}
 */
export const createVacation = async (accountId, input) => {
  const vacation = parseVacationInput(input);
  await requireNoOverlap(accountId, vacation, '0');
  const result = await execute(
    'INSERT INTO vacation (account_id, start_date, end_date, comment) VALUES (?, ?, ?, ?)',
    accountId, vacation.startDate, vacation.endDate, vacation.comment,
  );
  return { id: String(result.insertId) };
};

/**
 * Ändert einen eigenen Urlaub.
 * @param {string} accountId Aufrufer
 * @param {{id: string, startDate: string, endDate: string, comment?: string}} input
 * @returns {Promise<{id: string}>}
 */
export const updateVacation = async (accountId, input) => {
  const vacationId = requireId(input.id, 'Die Urlaubs-ID');
  const vacation = parseVacationInput(input);
  await requireOwnVacation(vacationId, accountId);
  await requireNoOverlap(accountId, vacation, vacationId);
  await execute(
    'UPDATE vacation SET start_date = ?, end_date = ?, comment = ? WHERE id = ? AND account_id = ?',
    vacation.startDate, vacation.endDate, vacation.comment, vacationId, accountId,
  );
  return { id: vacationId };
};

/**
 * Löscht einen eigenen Urlaub.
 * @param {string} accountId Aufrufer
 * @param {{id: string}} input
 * @returns {Promise<{id: string}>}
 */
export const deleteVacation = async (accountId, input) => {
  const vacationId = requireId(input.id, 'Die Urlaubs-ID');
  const result = await execute('DELETE FROM vacation WHERE id = ? AND account_id = ?', vacationId, accountId);
  if (result.affectedRows === 0) throw notFoundError('Der Urlaub wurde nicht gefunden.');
  return { id: vacationId };
};
