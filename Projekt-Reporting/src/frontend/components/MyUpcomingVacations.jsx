import React from 'react';
import { Box, Button, ButtonGroup, Heading, Inline, Stack, Text, xcss } from '@forge/react';
import { countWorkdays, formatRange } from '../utils/dateUtils';

/** Karten-Optik für einen einzelnen Urlaub. */
const cardStyle = xcss({
  padding: 'space.150',
  borderRadius: 'border.radius',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderColor: 'color.border',
});

/**
 * Eine Karte für einen eigenen Urlaub mit Bearbeiten/Löschen.
 * @param {object} props
 * @param {object} props.vacation
 * @param {(vacation: object) => void} props.onEdit
 * @param {(vacation: object) => void} props.onDelete
 */
const VacationCard = ({ vacation, onEdit, onDelete }) => (
  <Box xcss={cardStyle} testId={`my-vacation-${vacation.id}`}>
    <Inline spread="space-between" alignBlock="center" testId={`my-vacation-${vacation.id}-row`}>
      <Stack space="space.050" testId={`my-vacation-${vacation.id}-info`}>
        <Text>{formatRange(vacation.startDate, vacation.endDate)} · {countWorkdays(vacation.startDate, vacation.endDate)} Arbeitstage</Text>
        {vacation.comment && <Text>{vacation.comment}</Text>}
      </Stack>
      <ButtonGroup testId={`my-vacation-${vacation.id}-actions`}>
        <Button spacing="compact" onClick={() => onEdit(vacation)} testId={`my-vacation-${vacation.id}-edit`}>Bearbeiten</Button>
        <Button spacing="compact" appearance="subtle" onClick={() => onDelete(vacation)} testId={`my-vacation-${vacation.id}-delete`}>Löschen</Button>
      </ButtonGroup>
    </Inline>
  </Box>
);

/**
 * Liste der eigenen aktuellen und künftigen Urlaube unterhalb des Kalenders.
 * @param {object} props
 * @param {Array<object>} props.vacations Bereits vom Backend gefiltert und sortiert
 * @param {(vacation: object) => void} props.onEdit
 * @param {(vacation: object) => void} props.onDelete
 */
export const MyUpcomingVacations = ({ vacations, onEdit, onDelete }) => (
  <Stack space="space.100" testId="my-vacations">
    <Heading size="small" testId="my-vacations-heading">Meine nächsten Urlaube</Heading>
    {vacations.length === 0 && <Text testId="my-vacations-empty">Keine geplanten Urlaube.</Text>}
    {vacations.map((vacation) => (
      <VacationCard key={vacation.id} vacation={vacation} onEdit={onEdit} onDelete={onDelete} />
    ))}
  </Stack>
);
