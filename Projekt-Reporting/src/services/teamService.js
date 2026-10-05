import { execute, placeholders } from './db/sqlClient';
import { forbiddenError, notFoundError } from './errors';
import { requireAccountIds, requireId, requireTeamName } from './validation';

/*
 * Geschäftslogik für Teams.
 * Regeln: Jeder User darf Teams anlegen und wird Owner. Nur der Owner darf
 * sein Team umbenennen, Mitglieder ändern oder löschen. Sehen dürfen ein Team
 * nur seine Mitglieder. Der Owner ist immer Mitglied seines Teams.
 */

// Alle Teams, in denen der Aufrufer Mitglied ist – inkl. aller Mitglieder
const SELECT_TEAMS_FOR_MEMBER = `
  SELECT t.id, t.name, t.owner_account_id AS ownerAccountId, tm.account_id AS memberAccountId
  FROM team t
  JOIN team_member me ON me.team_id = t.id AND me.account_id = ?
  JOIN team_member tm ON tm.team_id = t.id
  ORDER BY t.name, t.id, tm.created_at`;

/**
 * Fasst die flachen Join-Zeilen zu Team-Objekten mit Mitgliederliste zusammen.
 * @param {Array<object>} rows
 * @param {string} accountId Aufrufer (für das isOwner-Flag)
 * @returns {Array<object>}
 */
const groupTeamRows = (rows, accountId) => {
  const teams = new Map();
  for (const row of rows) {
    const id = String(row.id);
    if (!teams.has(id)) {
      teams.set(id, {
        id, name: row.name, ownerAccountId: row.ownerAccountId,
        isOwner: row.ownerAccountId === accountId, memberAccountIds: [],
      });
    }
    teams.get(id).memberAccountIds.push(row.memberAccountId);
  }
  return [...teams.values()];
};

/**
 * Stellt sicher, dass der Owner in der Mitgliederliste steht (an erster Stelle).
 * @param {string[]} memberAccountIds
 * @param {string} ownerAccountId
 * @returns {string[]}
 */
const withOwner = (memberAccountIds, ownerAccountId) =>
  [ownerAccountId, ...memberAccountIds.filter((id) => id !== ownerAccountId)];

/**
 * Prüft, dass das Team existiert und der Aufrufer Owner ist.
 * @param {string} teamId
 * @param {string} accountId
 * @returns {Promise<void>}
 */
const requireOwnedTeam = async (teamId, accountId) => {
  const rows = await execute('SELECT owner_account_id AS ownerAccountId FROM team WHERE id = ?', teamId);
  if (rows.length === 0) throw notFoundError('Das Team wurde nicht gefunden.');
  if (rows[0].ownerAccountId !== accountId) throw forbiddenError('Nur der Owner darf dieses Team verwalten.');
};

/**
 * Fügt einem Team mehrere Mitglieder in einem einzigen INSERT hinzu.
 * @param {string} teamId
 * @param {string[]} accountIds
 * @returns {Promise<void>}
 */
const addMembers = async (teamId, accountIds) => {
  if (accountIds.length === 0) return;
  const values = accountIds.map(() => '(?, ?)').join(', ');
  const params = accountIds.flatMap((accountId) => [teamId, accountId]);
  await execute(`INSERT INTO team_member (team_id, account_id) VALUES ${values}`, ...params);
};

/**
 * Entfernt mehrere Mitglieder aus einem Team.
 * @param {string} teamId
 * @param {string[]} accountIds
 * @returns {Promise<void>}
 */
const removeMembers = async (teamId, accountIds) => {
  if (accountIds.length === 0) return;
  await execute(
    `DELETE FROM team_member WHERE team_id = ? AND account_id IN (${placeholders(accountIds.length)})`,
    teamId, ...accountIds,
  );
};

/**
 * Gleicht die gespeicherten Mitglieder mit der gewünschten Liste ab
 * (nur Differenzen werden geschrieben).
 * @param {string} teamId
 * @param {string[]} wantedAccountIds
 * @returns {Promise<void>}
 */
const syncMembers = async (teamId, wantedAccountIds) => {
  const rows = await execute('SELECT account_id AS accountId FROM team_member WHERE team_id = ?', teamId);
  const current = rows.map((row) => row.accountId);
  await removeMembers(teamId, current.filter((id) => !wantedAccountIds.includes(id)));
  await addMembers(teamId, wantedAccountIds.filter((id) => !current.includes(id)));
};

/**
 * Liefert alle Teams, in denen der Aufrufer Mitglied ist.
 * @param {string} accountId Aufrufer
 * @returns {Promise<Array<object>>}
 */
export const listTeamsForUser = async (accountId) => {
  const rows = await execute(SELECT_TEAMS_FOR_MEMBER, accountId);
  return groupTeamRows(rows, accountId);
};

/**
 * Prüft, dass der Aufrufer Mitglied des Teams ist. Für Nicht-Mitglieder
 * verhält sich das Team so, als gäbe es es nicht.
 * @param {string} teamId
 * @param {string} accountId
 * @returns {Promise<void>}
 */
export const requireTeamMembership = async (teamId, accountId) => {
  const rows = await execute(
    'SELECT 1 AS found FROM team_member tm JOIN team t ON t.id = tm.team_id WHERE tm.team_id = ? AND tm.account_id = ?',
    teamId, accountId,
  );
  if (rows.length === 0) throw notFoundError('Das Team wurde nicht gefunden.');
};

/**
 * Legt ein neues Team an; der Aufrufer wird Owner und Mitglied.
 * @param {string} accountId Aufrufer
 * @param {{name: string, memberAccountIds: string[]}} input
 * @returns {Promise<{id: string}>}
 */
export const createTeam = async (accountId, input) => {
  const name = requireTeamName(input.name);
  const memberAccountIds = withOwner(requireAccountIds(input.memberAccountIds ?? []), accountId);
  const result = await execute('INSERT INTO team (name, owner_account_id) VALUES (?, ?)', name, accountId);
  const teamId = String(result.insertId);
  await addMembers(teamId, memberAccountIds);
  return { id: teamId };
};

/**
 * Benennt ein eigenes Team um und aktualisiert die Mitglieder.
 * @param {string} accountId Aufrufer
 * @param {{id: string, name: string, memberAccountIds: string[]}} input
 * @returns {Promise<{id: string}>}
 */
export const updateTeam = async (accountId, input) => {
  const teamId = requireId(input.id, 'Die Team-ID');
  const name = requireTeamName(input.name);
  const memberAccountIds = withOwner(requireAccountIds(input.memberAccountIds ?? []), accountId);
  await requireOwnedTeam(teamId, accountId);
  await execute('UPDATE team SET name = ? WHERE id = ?', name, teamId);
  await syncMembers(teamId, memberAccountIds);
  return { id: teamId };
};

/**
 * Löscht ein eigenes Team samt Mitgliedschaften. Urlaube bleiben erhalten,
 * da sie den Usern gehören, nicht dem Team.
 * @param {string} accountId Aufrufer
 * @param {{id: string}} input
 * @returns {Promise<{id: string}>}
 */
export const deleteTeam = async (accountId, input) => {
  const teamId = requireId(input.id, 'Die Team-ID');
  await requireOwnedTeam(teamId, accountId);
  // Zuerst das Team löschen: schlägt der zweite Schritt fehl, sind die
  // verwaisten Mitgliedschaften unsichtbar (Abfragen joinen immer auf team).
  await execute('DELETE FROM team WHERE id = ?', teamId);
  await execute('DELETE FROM team_member WHERE team_id = ?', teamId);
  return { id: teamId };
};
