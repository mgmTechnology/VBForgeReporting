import { invoke } from '@forge/bridge';

/**
 * Ruft einen Backend-Resolver auf und packt das Antwortformat
 * { ok, data } / { ok: false, error } aus.
 * @param {string} name Name des Resolvers
 * @param {object} [payload]
 * @returns {Promise<unknown>} data der Antwort
 * @throws {Error} mit der (deutschen) Fehlermeldung des Backends
 */
const callResolver = async (name, payload = {}) => {
  const response = await invoke(name, payload);
  if (!response?.ok) {
    throw new Error(response?.error?.message ?? `Der Aufruf "${name}" ist fehlgeschlagen.`);
  }
  return response.data;
};

/**
 * Typisierte Wrapper für alle Resolver der Urlaubsplanung.
 * Die Komponenten kennen damit keine Resolver-Namen.
 */
export const api = {
  getMyTeams: () => callResolver('getMyTeams'),
  createTeam: (team) => callResolver('createTeam', team),
  updateTeam: (team) => callResolver('updateTeam', team),
  deleteTeam: (teamId) => callResolver('deleteTeam', { id: teamId }),
  getMyVacations: () => callResolver('getMyVacations'),
  getTeamVacations: (teamId, from, to) => callResolver('getTeamVacations', { teamId, from, to }),
  createVacation: (vacation) => callResolver('createVacation', vacation),
  updateVacation: (vacation) => callResolver('updateVacation', vacation),
  deleteVacation: (vacationId) => callResolver('deleteVacation', { id: vacationId }),
};
