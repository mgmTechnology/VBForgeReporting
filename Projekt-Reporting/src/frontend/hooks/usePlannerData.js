import { useCallback, useEffect, useState } from 'react';
import { view } from '@forge/bridge';
import { api } from '../services/apiClient';

/**
 * Lädt die Grunddaten der Urlaubsplanung (eigene Teams, eigene kommende
 * Urlaube, accountId des Aufrufers) und stellt die Schreibaktionen bereit.
 *
 * Schreibaktionen werfen bei Fehlern – die aufrufende Komponente (z. B. ein
 * Modal) zeigt die Meldung an. Nach jeder erfolgreichen Änderung werden die
 * Daten neu geladen und `version` erhöht, damit abhängige Ansichten
 * (Teamkalender) ebenfalls neu laden.
 *
 * @returns {object} Zustand und Aktionen
 */
export const usePlannerData = () => {
  const [state, setState] = useState({ loading: true, error: null, teams: [], myVacations: [], accountId: null });
  const [version, setVersion] = useState(0);

  const reload = useCallback(async () => {
    try {
      const [context, teams, myVacations] = await Promise.all([view.getContext(), api.getMyTeams(), api.getMyVacations()]);
      setState({ loading: false, error: null, teams, myVacations, accountId: context.accountId });
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /** Führt eine Änderung aus und lädt danach alles neu. Fehler werden weitergereicht. */
  const mutate = async (action) => {
    await action();
    setVersion((current) => current + 1);
    await reload();
  };

  return {
    ...state,
    version,
    saveVacation: (vacation) => mutate(() => (vacation.id ? api.updateVacation(vacation) : api.createVacation(vacation))),
    deleteVacation: (vacationId) => mutate(() => api.deleteVacation(vacationId)),
    saveTeam: (team) => mutate(() => (team.id ? api.updateTeam(team) : api.createTeam(team))),
    deleteTeam: (teamId) => mutate(() => api.deleteTeam(teamId)),
  };
};
