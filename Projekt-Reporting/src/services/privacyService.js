import { privacy } from '@forge/api';
import { execute } from './db/sqlClient';

/*
 * Datenschutz (DSGVO / Atlassian User Privacy Guidelines):
 * Apps, die accountIds speichern, müssen diese regelmäßig an Atlassian melden.
 * Für geschlossene Accounts müssen die zugehörigen Daten gelöscht werden.
 * https://developer.atlassian.com/platform/forge/user-privacy-guidelines/
 */

// Alle gespeicherten accountIds mit dem Zeitpunkt der letzten Änderung (UTC)
const SELECT_STORED_ACCOUNTS = `
  SELECT account_id AS accountId,
         DATE_FORMAT(MAX(changed_at), '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt
  FROM (
    SELECT account_id, updated_at AS changed_at FROM vacation
    UNION ALL SELECT account_id, created_at AS changed_at FROM team_member
    UNION ALL SELECT owner_account_id AS account_id, updated_at AS changed_at FROM team
  ) AS stored_accounts
  GROUP BY account_id`;

/**
 * Löscht alle Daten eines geschlossenen Accounts: seine Urlaube, seine
 * Mitgliedschaften und die Teams, deren Owner er war (inkl. Mitgliedschaften).
 * @param {string} accountId
 * @returns {Promise<void>}
 */
const eraseAccount = async (accountId) => {
  await execute('DELETE FROM vacation WHERE account_id = ?', accountId);
  await execute('DELETE FROM team_member WHERE team_id IN (SELECT id FROM team WHERE owner_account_id = ?)', accountId);
  await execute('DELETE FROM team WHERE owner_account_id = ?', accountId);
  await execute('DELETE FROM team_member WHERE account_id = ?', accountId);
};

/**
 * Meldet alle gespeicherten accountIds an Atlassian und löscht die Daten
 * geschlossener Accounts. privacy.reportPersonalData teilt die Liste
 * selbstständig in Pakete zu je 90 Accounts auf.
 * @returns {Promise<{reported: number, erased: number}>}
 */
export const reportAndErasePersonalData = async () => {
  const accounts = await execute(SELECT_STORED_ACCOUNTS);
  const updates = await privacy.reportPersonalData(accounts);
  const closedAccountIds = updates.filter((update) => update.status === 'closed').map((update) => update.accountId);
  for (const accountId of closedAccountIds) {
    await eraseAccount(accountId);
  }
  return { reported: accounts.length, erased: closedAccountIds.length };
};
