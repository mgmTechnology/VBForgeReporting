import React from 'react';
import { DynamicTable, Inline, Lozenge, Strong, Text, User } from '@forge/react';
import { formatDate } from '../utils/dateUtils';
import { getAbsenceDays, getAbsentMembers, hasPendingVacation } from '../utils/calendarModel';

/**
 * Tabellenkopf: erste Spalte Mitglied, danach eine Spalte je Kalenderwoche.
 * @param {Array<object>} weeks
 * @returns {object}
 */
const buildHead = (weeks) => ({
  cells: [
    { key: 'member', content: 'Mitglied' },
    ...weeks.map((week) => ({
      key: week.from,
      content: `KW ${week.week} · ${formatDate(week.from, false)}–${formatDate(week.to, false)}`,
    })),
  ],
});

/**
 * Zelle für ein Mitglied in einer Woche: Lozenge mit Anzahl Urlaubstage.
 * Grün = alles genehmigt, gelb = mindestens ein Urlaub ist noch beantragt.
 * @param {string} accountId
 * @param {object} week
 * @param {Array<object>} vacations
 */
const renderAbsenceCell = (accountId, week, vacations) => {
  const days = getAbsenceDays(accountId, week, vacations);
  const testId = `calendar-${accountId}-${week.from}`;
  if (days === 0) return <Text testId={testId}>·</Text>;
  const pending = hasPendingVacation(accountId, week, vacations);
  return (
    <Lozenge appearance={pending ? 'moved' : 'success'} isBold={days === 5} testId={testId}>
      {days === 5 ? 'ganze Woche' : `${days} ${days === 1 ? 'Tag' : 'Tage'}`}{pending ? ' (beantragt)' : ''}
    </Lozenge>
  );
};

/**
 * Zeile je Mitglied; der angemeldete User ist mit "Du" markiert.
 * @param {string} accountId
 * @param {string} currentAccountId
 * @param {Array<object>} weeks
 * @param {Array<object>} vacations
 * @returns {object}
 */
const buildMemberRow = (accountId, currentAccountId, weeks, vacations) => ({
  key: accountId,
  cells: [
    {
      key: 'member',
      content: (
        <Inline space="space.100" alignBlock="center" testId={`calendar-member-${accountId}`}>
          <User accountId={accountId} />
          {accountId === currentAccountId && <Lozenge appearance="new" testId={`calendar-member-${accountId}-me`}>Du</Lozenge>}
        </Inline>
      ),
    },
    ...weeks.map((week) => ({ key: week.from, content: renderAbsenceCell(accountId, week, vacations) })),
  ],
});

/**
 * Summenzeile: wie viele Mitglieder sind je Woche abwesend?
 * @param {object} team
 * @param {Array<object>} weeks
 * @param {Array<object>} vacations
 * @returns {object}
 */
const buildSummaryRow = (team, weeks, vacations) => ({
  key: 'summary',
  cells: [
    { key: 'member', content: <Strong>Abwesend</Strong> },
    ...weeks.map((week) => ({
      key: week.from,
      content: <Strong>{`${getAbsentMembers(team, week, vacations).length} / ${team.memberAccountIds.length}`}</Strong>,
    })),
  ],
});

/**
 * Wochenmatrix eines Teams für einen Monat (Zeilen = Mitglieder, Spalten = KW).
 * @param {object} props
 * @param {object} props.team
 * @param {string} props.currentAccountId
 * @param {Array<object>} props.weeks Wochen des gewählten Monats
 * @param {Array<object>} props.vacations Urlaube der Teammitglieder
 * @param {boolean} props.loading
 */
export const TeamCalendar = ({ team, currentAccountId, weeks, vacations, loading }) => (
  <DynamicTable
    testId="calendar-table"
    isLoading={loading}
    head={buildHead(weeks)}
    rows={[
      ...team.memberAccountIds.map((accountId) => buildMemberRow(accountId, currentAccountId, weeks, vacations)),
      buildSummaryRow(team, weeks, vacations),
    ]}
  />
);
