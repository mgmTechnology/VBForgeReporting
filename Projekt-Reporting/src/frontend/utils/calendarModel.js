import { countWorkdays, overlaps } from './dateUtils';
import { STATUS_PENDING } from './vacationStatus';

/** Ab diesem Anteil abwesender Mitglieder wird eine Woche als Engpass markiert. */
export const OVERLAP_THRESHOLD = 0.5;

/**
 * Berechnet, wie viele Arbeitstage ein Mitglied in einer Woche abwesend ist.
 * @param {string} accountId
 * @param {{from: string, to: string}} week Montag–Freitag als ISO-Strings
 * @param {Array<object>} vacations Urlaube des Teams
 * @returns {number}
 */
export const getAbsenceDays = (accountId, week, vacations) => vacations
  .filter((vacation) => vacation.accountId === accountId && overlaps(vacation, week.from, week.to))
  .reduce((days, vacation) => {
    // Nur den Teil des Urlaubs zählen, der in diese Woche fällt
    const from = vacation.startDate > week.from ? vacation.startDate : week.from;
    const to = vacation.endDate < week.to ? vacation.endDate : week.to;
    return days + countWorkdays(from, to);
  }, 0);

/**
 * Prüft, ob ein Mitglied in einer Woche einen noch nicht genehmigten Urlaub hat.
 * Abgelehnte Urlaube liefert das Backend für den Teamkalender gar nicht erst.
 * @param {string} accountId
 * @param {{from: string, to: string}} week
 * @param {Array<object>} vacations Urlaube des Teams
 * @returns {boolean}
 */
export const hasPendingVacation = (accountId, week, vacations) => vacations.some((vacation) =>
  vacation.accountId === accountId && vacation.status === STATUS_PENDING && overlaps(vacation, week.from, week.to));

/**
 * Liefert die accountIds der Mitglieder, die in einer Woche mindestens einen Tag fehlen.
 * @param {object} team
 * @param {{from: string, to: string}} week
 * @param {Array<object>} vacations
 * @returns {string[]}
 */
export const getAbsentMembers = (team, week, vacations) =>
  team.memberAccountIds.filter((accountId) => getAbsenceDays(accountId, week, vacations) > 0);

/**
 * Liefert die Wochen, in denen mindestens OVERLAP_THRESHOLD des Teams fehlt.
 * @param {object} team
 * @param {Array<object>} weeks
 * @param {Array<object>} vacations
 * @returns {Array<{week: object, absent: string[]}>}
 */
export const getCriticalWeeks = (team, weeks, vacations) => {
  const size = team.memberAccountIds.length;
  return weeks
    .map((week) => ({ week, absent: getAbsentMembers(team, week, vacations) }))
    .filter(({ absent }) => size > 1 && absent.length / size >= OVERLAP_THRESHOLD);
};
