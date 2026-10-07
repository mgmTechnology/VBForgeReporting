import React from 'react';
import { Badge, Button, DynamicTable, Heading, Inline, Stack, User } from '@forge/react';
import { countWorkdays, formatRange } from '../utils/dateUtils';

/** Spaltenköpfe der Tabelle offener Anträge. */
const HEAD = {
  cells: [
    { key: 'requester', content: 'Antragsteller' },
    { key: 'period', content: 'Zeitraum' },
    { key: 'workdays', content: 'Arbeitstage' },
    { key: 'comment', content: 'Kommentar' },
    { key: 'issue', content: 'Jira-Issue' },
    { key: 'action', content: '' },
  ],
};

/**
 * Tabellenzeile für einen offenen Antrag.
 * @param {object} vacation
 * @param {(vacation: object) => void} onDecide
 * @returns {object}
 */
const buildRow = (vacation, onDecide) => ({
  key: vacation.id,
  cells: [
    { key: 'requester', content: <User accountId={vacation.accountId} /> },
    { key: 'period', content: formatRange(vacation.startDate, vacation.endDate) },
    { key: 'workdays', content: String(countWorkdays(vacation.startDate, vacation.endDate)) },
    { key: 'comment', content: vacation.comment ?? '' },
    { key: 'issue', content: vacation.jiraIssueKey ?? '–' },
    {
      key: 'action',
      content: (
        <Button spacing="compact" appearance="primary" onClick={() => onDecide(vacation)} testId={`approval-${vacation.id}-decide`}>
          Entscheiden
        </Button>
      ),
    },
  ],
});

/**
 * Liste der Urlaubsanträge, die der angemeldete User genehmigen soll.
 * Wird nur angezeigt, wenn es offene Anträge gibt.
 * @param {object} props
 * @param {Array<object>} props.vacations Offene Anträge (vom Backend gefiltert)
 * @param {(vacation: object) => void} props.onDecide Öffnet das Entscheidungs-Modal
 */
export const PendingApprovals = ({ vacations, onDecide }) => (
  <Stack space="space.100" testId="pending-approvals">
    <Inline space="space.100" alignBlock="center" testId="pending-approvals-header">
      <Heading size="small">Zu genehmigen</Heading>
      <Badge appearance="primary">{vacations.length}</Badge>
    </Inline>
    <DynamicTable testId="pending-approvals-table" head={HEAD} rows={vacations.map((vacation) => buildRow(vacation, onDecide))} />
  </Stack>
);
