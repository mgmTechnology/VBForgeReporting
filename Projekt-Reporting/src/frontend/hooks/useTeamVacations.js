import { useEffect, useState } from 'react';
import { api } from '../services/apiClient';

/**
 * Lädt die Urlaube aller Mitglieder eines Teams für einen Zeitraum.
 * Lädt neu, sobald sich Team, Zeitraum oder `version` (nach Änderungen) ändern.
 * Veraltete Antworten (z. B. nach schnellem Monatswechsel) werden verworfen.
 *
 * @param {string|undefined} teamId
 * @param {string} from Erster Tag (ISO)
 * @param {string} to Letzter Tag (ISO)
 * @param {number} version Änderungszähler aus usePlannerData
 * @returns {{vacations: Array<object>, loading: boolean, error: string|null}}
 */
export const useTeamVacations = (teamId, from, to, version) => {
  const [state, setState] = useState({ vacations: [], loading: false, error: null });

  useEffect(() => {
    if (!teamId) return undefined;
    let isCurrent = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    api.getTeamVacations(teamId, from, to)
      .then((vacations) => isCurrent && setState({ vacations, loading: false, error: null }))
      .catch((error) => isCurrent && setState({ vacations: [], loading: false, error: error.message }));
    return () => { isCurrent = false; };
  }, [teamId, from, to, version]);

  return state;
};
