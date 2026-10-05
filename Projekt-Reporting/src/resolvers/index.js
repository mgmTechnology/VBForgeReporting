import Resolver from '@forge/resolver';
import { ensureSchema } from '../services/db/schema';
import { AppError, forbiddenError } from '../services/errors';
import { createTeam, deleteTeam, listTeamsForUser, updateTeam } from '../services/teamService';
import {
  createVacation, deleteVacation, listTeamVacations, listUpcomingVacations, updateVacation,
} from '../services/vacationService';

/*
 * Resolver = Backend-Endpunkte, die das Frontend per invoke('<name>', payload)
 * aufruft. Sie sind bewusst schlank und delegieren an die Services.
 *
 * Sicherheit: Die Identität des Aufrufers kommt IMMER aus context.accountId
 * (von Forge gesetzt), niemals aus dem Payload.
 *
 * Antwortformat: { ok: true, data } oder { ok: false, error: { code, message } }.
 * So kommen fachliche Fehlermeldungen zuverlässig im Frontend an.
 */

const resolver = new Resolver();

/**
 * Baut die Fehlerantwort. Fachliche Fehler gehen mit Meldung an das Frontend,
 * technische Fehler werden geloggt (ohne Payload, da personenbezogen) und
 * nur generisch gemeldet.
 * @param {string} name Name des Resolvers
 * @param {unknown} error
 * @returns {{ok: false, error: {code: string, message: string}}}
 */
const toErrorResponse = (name, error) => {
  if (error instanceof AppError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  console.error(`Resolver "${name}" fehlgeschlagen:`, error);
  return { ok: false, error: { code: 'INTERNAL', message: 'Es ist ein technischer Fehler aufgetreten. Bitte später erneut versuchen.' } };
};

/**
 * Registriert einen Resolver mit einheitlicher Schema-Prüfung,
 * Authentifizierung und Fehlerbehandlung.
 * @param {string} name Name, unter dem das Frontend den Resolver aufruft
 * @param {(accountId: string, payload: object) => Promise<unknown>} action Service-Funktion
 */
const defineAction = (name, action) => {
  resolver.define(name, async ({ payload, context }) => {
    try {
      if (!context?.accountId) throw forbiddenError('Bitte melde dich an, um diese Funktion zu nutzen.');
      await ensureSchema();
      return { ok: true, data: await action(context.accountId, payload ?? {}) };
    } catch (error) {
      return toErrorResponse(name, error);
    }
  });
};

defineAction('getMyTeams', (accountId) => listTeamsForUser(accountId));
defineAction('createTeam', createTeam);
defineAction('updateTeam', updateTeam);
defineAction('deleteTeam', deleteTeam);

defineAction('getMyVacations', (accountId) => listUpcomingVacations(accountId));
defineAction('getTeamVacations', listTeamVacations);
defineAction('createVacation', createVacation);
defineAction('updateVacation', updateVacation);
defineAction('deleteVacation', deleteVacation);

export const handler = resolver.getDefinitions();
