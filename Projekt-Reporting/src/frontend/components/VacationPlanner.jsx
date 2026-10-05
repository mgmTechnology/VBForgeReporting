import React, { useState } from 'react';
import { EmptyState, ModalTransition, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import { formatRange, getWeeksOfMonth } from '../utils/dateUtils';
import { getCriticalWeeks } from '../utils/calendarModel';
import { usePlannerData } from '../hooks/usePlannerData';
import { useTeamVacations } from '../hooks/useTeamVacations';
import { ConfirmModal } from './ConfirmModal';
import { MyUpcomingVacations } from './MyUpcomingVacations';
import { OverlapWarnings } from './OverlapWarnings';
import { PlannerToolbar } from './PlannerToolbar';
import { TeamCalendar } from './TeamCalendar';
import { TeamFormModal } from './TeamFormModal';
import { VacationFormModal } from './VacationFormModal';

/**
 * Verschiebt einen Monat um +/- n Monate.
 * @param {{year: number, month: number}} period
 * @param {number} delta
 * @returns {{year: number, month: number}}
 */
const shiftMonth = ({ year, month }, delta) => {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
};

/**
 * Teambereich: Kopfzeile, Engpass-Warnungen und Wochenmatrix.
 * @param {object} props
 */
const TeamArea = ({ team, currentAccountId, weeks, version }) => {
  const { vacations, loading, error } = useTeamVacations(team.id, weeks[0].from, weeks[weeks.length - 1].to, version);
  return (
    <Stack space="space.200" testId="team-area">
      <Text testId="team-meta">{team.memberAccountIds.length} Mitglieder{team.isOwner ? ' · Du bist Owner' : ''}</Text>
      {error && <SectionMessage appearance="error" testId="team-error"><Text>{error}</Text></SectionMessage>}
      <OverlapWarnings criticalWeeks={getCriticalWeeks(team, weeks, vacations)} teamSize={team.memberAccountIds.length} />
      <TeamCalendar team={team} currentAccountId={currentAccountId} weeks={weeks} vacations={vacations} loading={loading} />
    </Stack>
  );
};

/**
 * Alle Modals der Seite. Zustand: undefined = geschlossen, null = neu, Objekt = bearbeiten.
 * @param {object} props
 */
const PlannerModals = ({ data, editingVacation, setEditingVacation, deletingVacation, setDeletingVacation, editingTeam, setEditingTeam }) => (
  <ModalTransition>
    {editingVacation !== undefined && (
      <VacationFormModal vacation={editingVacation} onSave={data.saveVacation} onClose={() => setEditingVacation(undefined)} />
    )}
    {deletingVacation && (
      <ConfirmModal idPrefix="vacation-delete" title="Urlaub löschen?" confirmLabel="Löschen"
        message={`Der Urlaub ${formatRange(deletingVacation.startDate, deletingVacation.endDate)} wird gelöscht.`}
        onConfirm={() => data.deleteVacation(deletingVacation.id)} onClose={() => setDeletingVacation(null)} />
    )}
    {editingTeam !== undefined && (
      <TeamFormModal team={editingTeam} currentAccountId={data.accountId} onSave={data.saveTeam}
        onDelete={data.deleteTeam} onClose={() => setEditingTeam(undefined)} />
    )}
  </ModalTransition>
);

/**
 * Hauptseite der Urlaubsplanung (Team-Kalender): oben das gewählte Team als
 * Wochenmatrix mit Engpass-Warnungen, darunter die eigenen Urlaube.
 */
export const VacationPlanner = () => {
  const data = usePlannerData();
  const [selectedTeamId, setSelectedTeamId] = useState(undefined);
  const [period, setPeriod] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [editingVacation, setEditingVacation] = useState(undefined);
  const [deletingVacation, setDeletingVacation] = useState(null);
  const [editingTeam, setEditingTeam] = useState(undefined);

  if (data.loading) return <Spinner label="Lade Urlaubsplanung" testId="planner-loading" />;
  if (data.error) return <SectionMessage appearance="error" title="Laden fehlgeschlagen" testId="planner-error"><Text>{data.error}</Text></SectionMessage>;

  // Fällt auf das erste Team zurück, z. B. beim ersten Laden oder nach dem Löschen des gewählten Teams
  const team = data.teams.find((t) => t.id === selectedTeamId) ?? data.teams[0];
  const weeks = getWeeksOfMonth(period.year, period.month);

  return (
    <Stack space="space.300" testId="planner-root">
      <PlannerToolbar teams={data.teams} team={team} onSelectTeam={setSelectedTeamId} period={period}
        onShiftMonth={(delta) => setPeriod(shiftMonth(period, delta))} onAddVacation={() => setEditingVacation(null)}
        onEditTeam={setEditingTeam} onNewTeam={() => setEditingTeam(null)} />
      {team
        ? <TeamArea team={team} currentAccountId={data.accountId} weeks={weeks} version={data.version} />
        : <EmptyState header="Du bist noch in keinem Team" description="Lege über „+ Neues Team“ dein erstes Team an." testId="planner-no-team" />}
      <MyUpcomingVacations vacations={data.myVacations} onEdit={setEditingVacation} onDelete={setDeletingVacation} />
      <PlannerModals data={data} editingVacation={editingVacation} setEditingVacation={setEditingVacation}
        deletingVacation={deletingVacation} setDeletingVacation={setDeletingVacation}
        editingTeam={editingTeam} setEditingTeam={setEditingTeam} />
    </Stack>
  );
};
