import { execute } from './db/sqlClient';
import { notFoundError, validationError } from './errors';
import { createApprovalIssue, notifyCancelled, notifyDecision, notifyRequestChanged } from './approvalIssueService';
import { requireTeamMembership } from './teamService';
import { optionalText, requireAccountId, requireDateRange, requireId } from './validation';

/*
 * Geschäftslogik für Urlaube.
 * Regeln: Jeder User verwaltet nur seine eigenen Urlaube. Urlaube anderer
 * sieht man nur über ein Team, in dem man selbst Mitglied ist.
 *
 * Genehmigung: Jeder Urlaub ist ein Antrag mit einer frei gewählten
 * genehmigenden Person (nicht man selbst). Neue und geänderte Anträge sind
 * 'PENDING', bis die genehmigende Person sie auf 'APPROVED' oder 'REJECTED'
 * setzt. Die genehmigende Person wird über ein Jira-Issue benachrichtigt
 * (siehe approvalIssueService). Abgelehnte Urlaube zählen weder bei der
 * Überschneidungsprüfung noch im Teamkalender.
 */

/** Maximale Länge eines einzelnen Urlaubs in Kalendertagen. */
const MAX_VACATION_DAYS = 366;
/** Maximale Länge des Abfragezeitraums für die Teamansicht. */
const MAX_QUERY_DAYS = 100;
const MAX_COMMENT_LENGTH = 500;

const STATUS_PENDING = 'PENDING';
const STATUS_APPROVED = 'APPROVED';
const STATUS_REJECTED = 'REJECTED';

// DATE_FORMAT liefert die Daten als 'YYYY-MM-DD' – genau das Format des DatePickers
const VACATION_COLUMNS = `
  v.id, v.account_id AS accountId,
  DATE_FORMAT(v.start_date, '%Y-%m-%d') AS startDate,
  DATE_FORMAT(v.end_date, '%Y-%m-%d') AS endDate,
  v.comment, v.status, v.approver_account_id AS approverAccountId,
  v.decision_comment AS decisionComment, v.jira_issue_key AS jiraIssueKey`;

const SELECT_UPCOMING_FOR_USER = `
  SELECT ${VACATION_COLUMNS} FROM vacation v
  WHERE v.account_id = ? AND v.end_date >= CURDATE()
  ORDER BY v.start_date`;

const SELECT_FOR_TEAM_IN_RANGE = `
  SELECT ${VACATION_COLUMNS} FROM vacation v
  WHERE v.account_id IN (SELECT tm.account_id FROM team_member tm WHERE tm.team_id = ?)
    AND v.start_date <= ? AND v.end_date >= ?
    AND v.status <> '${STATUS_REJECTED}'
  ORDER BY v.start_date`;

// Offene Anträge, die der Aufrufer entscheiden soll
const SELECT_PENDING_FOR_APPROVER = `
  SELECT ${VACATION_COLUMNS} FROM vacation v
  WHERE v.approver_account_id = ? AND v.status = '${STATUS_PENDING}'
  ORDER BY v.start_date`;

// Überschneidung mit eigenen Urlauben (der bearbeitete Urlaub selbst und abgelehnte zählen nicht)
const SELECT_OWN_OVERLAP = `
  SELECT 1 AS found FROM vacation
  WHERE account_id = ? AND start_date <= ? AND end_date >= ? AND id <> ?
    AND status <> '${STATUS_REJECTED}'
  LIMIT 1`;

/**
 * Wandelt eine DB-Zeile in das Format für das Frontend.
 * @param {object} row
 * @returns {object}
 */
const toVacation = (row) => ({
  id: String(row.id),
  accountId: row.accountId,
  startDate: row.startDate,
  endDate: row.endDate,
  comment: row.comment,
  status: row.status,
  approverAccountId: row.approverAccountId,
  decisionComment: row.decisionComment,
  jiraIssueKey: row.jiraIssueKey,
});

/**
 * Prüft und normalisiert die Eingaben eines Urlaubsantrags.
 * @param {object} input
 * @param {string} accountId Antragsteller
 * @returns {{startDate: string, endDate: string, comment: string|null, approverAccountId: string}}
 */
const parseVacationInput = (input, accountId) => {
  const approverAccountId = requireAccountId(input.approverAccountId, 'eine genehmigende Person');
  if (approverAccountId === accountId) throw validationError('Du kannst deinen eigenen Urlaub nicht selbst genehmigen.');
  return {
    ...requireDateRange(input.startDate, input.endDate, MAX_VACATION_DAYS),
    comment: optionalText(input.comment, MAX_COMMENT_LENGTH, 'Der Kommentar'),
    approverAccountId,
  };
};

/**
 * Prüft die Entscheidung der genehmigenden Person.
 * @param {unknown} value
 * @returns {'APPROVED'|'REJECTED'}
 */
const requireDecision = (value) => {
  if (value !== STATUS_APPROVED && value !== STATUS_REJECTED) throw validationError('Die Entscheidung ist ungültig.');
  return value;
};

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
 * Lädt den Genehmigungsstand eines eigenen Urlaubs.
 * @param {string} vacationId
 * @param {string} accountId
 * @returns {Promise<{status: string, approverAccountId: string|null, jiraIssueKey: string|null}>}
 * @throws {AppError} NOT_FOUND, wenn der Urlaub nicht existiert oder nicht dem Aufrufer gehört
 */
const loadOwnVacation = async (vacationId, accountId) => {
  const rows = await execute(
    `SELECT status, approver_account_id AS approverAccountId, jira_issue_key AS jiraIssueKey
     FROM vacation WHERE id = ? AND account_id = ?`,
    vacationId, accountId,
  );
  if (rows.length === 0) throw notFoundError('Der Urlaub wurde nicht gefunden.');
  return rows[0];
};

/**
 * Liefert die eigenen aktuellen und künftigen Urlaube (inkl. offener und abgelehnter Anträge).
 * @param {string} accountId Aufrufer
 * @returns {Promise<Array<object>>}
 */
export const listUpcomingVacations = async (accountId) =>
  (await execute(SELECT_UPCOMING_FOR_USER, accountId)).map(toVacation);

/**
 * Liefert alle nicht abgelehnten Urlaube der Mitglieder eines Teams, die einen
 * Zeitraum berühren. Nur für Mitglieder des Teams erlaubt.
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
 * Liefert die offenen Anträge, die der Aufrufer genehmigen soll.
 * @param {string} accountId Aufrufer (genehmigende Person)
 * @returns {Promise<Array<object>>}
 */
export const listPendingApprovals = async (accountId) =>
  (await execute(SELECT_PENDING_FOR_APPROVER, accountId)).map(toVacation);

/**
 * Beantragt einen eigenen Urlaub und benachrichtigt die genehmigende Person
 * über ein Jira-Issue. Kann das Issue nicht angelegt werden, wird der Antrag
 * wieder entfernt – sonst würde die genehmigende Person nie davon erfahren.
 * @param {string} accountId Aufrufer
 * @param {{startDate: string, endDate: string, comment?: string, approverAccountId: string}} input
 * @returns {Promise<{id: string}>}
 */
export const createVacation = async (accountId, input) => {
  const vacation = parseVacationInput(input, accountId);
  await requireNoOverlap(accountId, vacation, '0');
  const result = await execute(
    `INSERT INTO vacation (account_id, start_date, end_date, comment, status, approver_account_id)
     VALUES (?, ?, ?, ?, '${STATUS_PENDING}', ?)`,
    accountId, vacation.startDate, vacation.endDate, vacation.comment, vacation.approverAccountId,
  );
  const vacationId = String(result.insertId);

  let issueKey;
  try {
    issueKey = await createApprovalIssue(accountId, vacation);
  } catch (error) {
    await execute('DELETE FROM vacation WHERE id = ?', vacationId);
    throw error;
  }

  // Das Issue existiert und der Genehmiger ist informiert. Scheitert nur das
  // Speichern des Keys, bleibt der Antrag gültig (spätere Änderungen legen dann ein neues Issue an).
  try {
    await execute('UPDATE vacation SET jira_issue_key = ? WHERE id = ?', issueKey, vacationId);
  } catch (error) {
    console.error(`Issue-Key ${issueKey} konnte nicht am Urlaub ${vacationId} gespeichert werden:`, error);
  }
  return { id: vacationId };
};

/**
 * Ändert einen eigenen Urlaubsantrag. Jede Änderung muss neu genehmigt werden
 * (Status zurück auf 'PENDING'), auch wenn der Antrag schon entschieden war.
 * @param {string} accountId Aufrufer
 * @param {{id: string, startDate: string, endDate: string, comment?: string, approverAccountId: string}} input
 * @returns {Promise<{id: string}>}
 */
export const updateVacation = async (accountId, input) => {
  const vacationId = requireId(input.id, 'Die Urlaubs-ID');
  const vacation = parseVacationInput(input, accountId);
  const current = await loadOwnVacation(vacationId, accountId);
  await requireNoOverlap(accountId, vacation, vacationId);

  // Urlaube ohne Issue (z. B. aus der Zeit vor dem Genehmigungs-Workflow) bekommen
  // jetzt eines – vor dem Speichern, damit bei einem Jira-Fehler nichts geändert wird.
  const issueKey = current.jiraIssueKey ?? await createApprovalIssue(accountId, vacation);

  await execute(
    `UPDATE vacation
     SET start_date = ?, end_date = ?, comment = ?, approver_account_id = ?, jira_issue_key = ?,
         status = '${STATUS_PENDING}', decided_at = NULL, decision_comment = NULL
     WHERE id = ? AND account_id = ?`,
    vacation.startDate, vacation.endDate, vacation.comment, vacation.approverAccountId, issueKey,
    vacationId, accountId,
  );

  if (current.jiraIssueKey) {
    await notifyRequestChanged(issueKey, vacation, {
      approverChanged: current.approverAccountId !== vacation.approverAccountId,
      wasDecided: current.status !== STATUS_PENDING,
    });
  }
  return { id: vacationId };
};

/**
 * Löscht (storniert) einen eigenen Urlaub und vermerkt das am Jira-Issue.
 * @param {string} accountId Aufrufer
 * @param {{id: string}} input
 * @returns {Promise<{id: string}>}
 */
export const deleteVacation = async (accountId, input) => {
  const vacationId = requireId(input.id, 'Die Urlaubs-ID');
  const current = await loadOwnVacation(vacationId, accountId);
  const result = await execute('DELETE FROM vacation WHERE id = ? AND account_id = ?', vacationId, accountId);
  if (result.affectedRows === 0) throw notFoundError('Der Urlaub wurde nicht gefunden.');
  if (current.jiraIssueKey) {
    await notifyCancelled(current.jiraIssueKey, { wasPending: current.status === STATUS_PENDING });
  }
  return { id: vacationId };
};

/**
 * Genehmigt oder lehnt einen offenen Antrag ab. Nur die eingetragene
 * genehmigende Person darf entscheiden. Berechtigung und Schutz vor doppelter
 * Entscheidung stecken in der WHERE-Klausel (ein atomares UPDATE).
 * @param {string} accountId Aufrufer (genehmigende Person)
 * @param {{id: string, decision: 'APPROVED'|'REJECTED', comment?: string}} input
 * @returns {Promise<{id: string}>}
 */
export const decideVacation = async (accountId, input) => {
  const vacationId = requireId(input.id, 'Die Urlaubs-ID');
  const decision = requireDecision(input.decision);
  const decisionComment = optionalText(input.comment, MAX_COMMENT_LENGTH, 'Die Begründung');

  const result = await execute(
    `UPDATE vacation SET status = ?, decided_at = NOW(), decision_comment = ?
     WHERE id = ? AND approver_account_id = ? AND status = '${STATUS_PENDING}'`,
    decision, decisionComment, vacationId, accountId,
  );
  if (result.affectedRows === 0) throw notFoundError('Der Antrag wurde nicht gefunden oder ist bereits entschieden.');

  const rows = await execute('SELECT jira_issue_key AS jiraIssueKey FROM vacation WHERE id = ?', vacationId);
  if (rows[0]?.jiraIssueKey) {
    await notifyDecision(rows[0].jiraIssueKey, { approved: decision === STATUS_APPROVED, decisionComment });
  }
  return { id: vacationId };
};
