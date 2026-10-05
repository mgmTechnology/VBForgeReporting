import { ensureSchema } from '../services/db/schema';
import { reportAndErasePersonalData } from '../services/privacyService';

/**
 * Wöchentlicher Scheduled Trigger: meldet gespeicherte accountIds an
 * Atlassian und löscht Daten geschlossener Accounts.
 * Fehler werden geloggt und erneut geworfen, damit der Lauf in den
 * Forge-Logs als fehlgeschlagen erscheint.
 * @returns {Promise<void>}
 */
export const run = async () => {
  try {
    await ensureSchema();
    const { reported, erased } = await reportAndErasePersonalData();
    console.log(`Personal Data Reporting: ${reported} Accounts gemeldet, ${erased} geschlossene Accounts gelöscht.`);
  } catch (error) {
    console.error('Personal Data Reporting fehlgeschlagen:', error);
    throw error;
  }
};
