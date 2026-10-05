import React from 'react';
import { SectionMessage, Text, User } from '@forge/react';

/**
 * Warnhinweise für Wochen, in denen mindestens die Hälfte des Teams fehlt.
 * Rendert nichts, wenn es keine Engpässe gibt.
 *
 * @param {object} props
 * @param {Array<{week: object, absent: string[]}>} props.criticalWeeks
 * @param {number} props.teamSize
 */
export const OverlapWarnings = ({ criticalWeeks, teamSize }) => {
  if (criticalWeeks.length === 0) return null;
  return (
    <SectionMessage appearance="warning" title="Engpässe im Team" testId="overlap-warning">
      {criticalWeeks.map(({ week, absent }) => (
        <Text key={week.from} testId={`overlap-${week.from}`}>
          KW {week.week}: {absent.length} von {teamSize} abwesend –{' '}
          {absent.map((accountId) => <User key={accountId} accountId={accountId} />)}
        </Text>
      ))}
    </SectionMessage>
  );
};
