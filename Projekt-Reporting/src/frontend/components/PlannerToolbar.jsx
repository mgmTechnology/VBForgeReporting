import React from 'react';
import { Button, Heading, Inline, Select } from '@forge/react';
import { formatMonth } from '../utils/dateUtils';

/**
 * Werkzeugleiste: Teamauswahl, Team-Aktionen, Monatsnavigation, Urlaub eintragen.
 * "Team bearbeiten" erscheint nur für den Owner (reine Anzeige-Steuerung –
 * die Berechtigung prüft das Backend).
 *
 * @param {object} props
 * @param {Array<object>} props.teams Teams, in denen der User Mitglied ist
 * @param {object|undefined} props.team Ausgewähltes Team
 * @param {(teamId: string) => void} props.onSelectTeam
 * @param {{year: number, month: number}} props.period
 * @param {(delta: number) => void} props.onShiftMonth
 * @param {() => void} props.onAddVacation
 * @param {(team: object) => void} props.onEditTeam
 * @param {() => void} props.onNewTeam
 */
export const PlannerToolbar = ({ teams, team, onSelectTeam, period, onShiftMonth, onAddVacation, onEditTeam, onNewTeam }) => {
  const options = teams.map((t) => ({ label: t.name, value: t.id }));
  return (
    <Inline spread="space-between" alignBlock="center" shouldWrap testId="toolbar">
      <Inline space="space.100" alignBlock="center" testId="toolbar-team">
        <Select inputId="toolbar-team-select" testId="toolbar-team-select" options={options} placeholder="Team wählen"
          value={options.find((o) => o.value === team?.id) ?? null} onChange={(option) => onSelectTeam(option.value)} />
        {team?.isOwner && <Button onClick={() => onEditTeam(team)} testId="toolbar-team-edit">Team bearbeiten</Button>}
        <Button appearance="subtle" onClick={onNewTeam} testId="toolbar-team-new">+ Neues Team</Button>
      </Inline>
      <Inline space="space.100" alignBlock="center" testId="toolbar-period">
        <Button onClick={() => onShiftMonth(-1)} testId="toolbar-month-prev">‹</Button>
        <Heading size="small" testId="toolbar-month-label">{formatMonth(period.year, period.month)}</Heading>
        <Button onClick={() => onShiftMonth(1)} testId="toolbar-month-next">›</Button>
        <Button appearance="primary" onClick={onAddVacation} testId="toolbar-vacation-add">Urlaub eintragen</Button>
      </Inline>
    </Inline>
  );
};
