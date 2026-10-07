import api, { route } from '@forge/api';
import { jiraError } from './errors';

/*
 * Benachrichtigung der genehmigenden Person über ein Jira-Issue.
 *
 * Für jeden Urlaubsantrag legt die App im konfigurierten Projekt ein Issue an,
 * dessen Bearbeiter (Assignee) die genehmigende Person ist. Jira verschickt
 * dann über das Benachrichtigungsschema selbst die Mail „Vorgang zugewiesen“.
 *
 * Führend ist immer der Status in der App-Datenbank. Das Issue ist nur die
 * Benachrichtigung bzw. Aufgabe: Änderungen, Entscheidungen und Stornierungen
 * werden als Kommentar ergänzt und das Issue danach erledigt.
 *
 * Alle Aufrufe laufen mit asUser(): Jira prüft dabei selbst, ob der
 * angemeldete User im Projekt Issues anlegen, zuweisen, kommentieren und
 * den Status ändern darf.
 *
 * Konfiguration je Umgebung über Forge-Umgebungsvariablen, z. B.:
 *   forge variables set --environment development JIRA_APPROVAL_PROJECT URLAUB
 *   forge variables set --environment development JIRA_APPROVAL_ISSUE_TYPE Aufgabe
 * JIRA_APPROVAL_ISSUE_TYPE darf ein Name (z. B. „Aufgabe“) oder eine numerische ID sein.
 */

/** Status-Kategorien von Jira: 'new' = offen, 'indeterminate' = in Arbeit, 'done' = erledigt. */
const CATEGORY_DONE = 'done';
const CATEGORIES_OPEN = ['new', 'indeterminate'];

/**
 * Liest die Konfiguration aus den Umgebungsvariablen.
 * @returns {{project: {key: string}, issuetype: {id: string}|{name: string}}}
 */
const readConfig = () => {
  const projectKey = process.env.JIRA_APPROVAL_PROJECT?.trim();
  const issueType = process.env.JIRA_APPROVAL_ISSUE_TYPE?.trim();
  if (!projectKey || !issueType) {
    throw jiraError('Die Jira-Anbindung für Urlaubsanträge ist nicht konfiguriert. Bitte wende dich an den App-Administrator.');
  }
  return {
    project: { key: projectKey },
    // Jira akzeptiert den Issue-Typ wahlweise per ID oder per (sprachabhängigem) Namen
    issuetype: /^\d+$/.test(issueType) ? { id: issueType } : { name: issueType },
  };
};

/**
 * Formatiert ein ISO-Datum deutsch, z. B. '2026-10-19' -> '19.10.2026'.
 * @param {string} iso
 * @returns {string}
 */
const formatDate = (iso) => iso.split('-').reverse().join('.');

/**
 * @param {{startDate: string, endDate: string}} vacation
 * @returns {string} z. B. '19.10.2026 – 23.10.2026'
 */
const formatRange = ({ startDate, endDate }) => `${formatDate(startDate)} – ${formatDate(endDate)}`;

/*
 * Bausteine für das Atlassian Document Format (ADF). Die REST API v3
 * erwartet Beschreibung und Kommentare in diesem JSON-Format statt als Text.
 */
const text = (value, strong = false) => ({ type: 'text', text: value, ...(strong && { marks: [{ type: 'strong' }] }) });
const mention = (accountId) => ({ type: 'mention', attrs: { id: accountId } });
const paragraph = (...content) => ({ type: 'paragraph', content });
const doc = (...paragraphs) => ({ type: 'doc', version: 1, content: paragraphs.filter(Boolean) });

/**
 * Baut aus einer Fehlerantwort von Jira eine lesbare Meldung.
 * Jira liefert Fehler als { errorMessages: [...], errors: { feld: meldung } }.
 * @param {object|null} body
 * @returns {string}
 */
const describeJiraError = (body) => {
  const messages = [...(body?.errorMessages ?? []), ...Object.values(body?.errors ?? {})];
  return messages.length > 0 ? messages.join(' ') : 'Unbekannter Fehler.';
};

/**
 * Führt einen Jira-REST-Aufruf im Namen des angemeldeten Users aus.
 * Plattformfehler (z. B. fehlende Zustimmung des Users) wirft requestJira
 * selbst – sie werden bewusst nicht abgefangen, damit Forge sie behandeln kann.
 * @param {import('@forge/api').Route} path
 * @param {string} [method='GET']
 * @param {object} [body]
 * @returns {Promise<object|null>} JSON-Antwort oder null bei 204 No Content
 * @throws {AppError} mit Jiras Fehlermeldung, wenn Jira die Anfrage ablehnt
 */
const jiraRequest = async (path, method = 'GET', body = undefined) => {
  const response = await api.asUser().requestJira(path, {
    method,
    headers: { Accept: 'application/json', ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  const json = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw jiraError(`Jira hat die Anfrage abgelehnt (HTTP ${response.status}): ${describeJiraError(json)}`);
  }
  return json;
};

/**
 * Fügt einem Issue einen Kommentar hinzu (benachrichtigt u. a. den Bearbeiter).
 * @param {string} issueKey
 * @param {...object} paragraphs ADF-Absätze
 * @returns {Promise<void>}
 */
const addComment = (issueKey, ...paragraphs) =>
  jiraRequest(route`/rest/api/3/issue/${issueKey}/comment`, 'POST', { body: doc(...paragraphs) });

/**
 * Führt die erste verfügbare Transition aus, deren Zielstatus in einer der
 * gewünschten Status-Kategorien liegt. Transition-IDs sind je Workflow
 * verschieden, deshalb wird über die Status-Kategorie gesucht.
 * @param {string} issueKey
 * @param {string[]} categories Status-Kategorien in absteigender Priorität
 * @returns {Promise<boolean>} false, wenn der Workflow keine passende Transition anbietet
 */
const transitionToCategory = async (issueKey, categories) => {
  const { transitions = [] } = await jiraRequest(route`/rest/api/3/issue/${issueKey}/transitions`);
  for (const category of categories) {
    const transition = transitions.find((t) => t.to?.statusCategory?.key === category);
    if (transition) {
      await jiraRequest(route`/rest/api/3/issue/${issueKey}/transitions`, 'POST', { transition: { id: transition.id } });
      return true;
    }
  }
  return false;
};

/**
 * Führt Folgeaktualisierungen am Issue aus, ohne den eigentlichen Vorgang
 * scheitern zu lassen: Die Änderung ist in der App bereits gespeichert und
 * dort führend. Fehler werden nur geloggt (ohne personenbezogene Daten).
 * @param {string} issueKey
 * @param {string} action Beschreibung für das Log
 * @param {() => Promise<void>} update
 * @returns {Promise<void>}
 */
const updateIssueSafely = async (issueKey, action, update) => {
  try {
    await update();
  } catch (error) {
    console.warn(`Jira-Issue ${issueKey} konnte nicht aktualisiert werden (${action}):`, error.message);
  }
};

/**
 * Legt das Issue für einen neuen Urlaubsantrag an. Schlägt das fehl, wirft die
 * Funktion – der Aufrufer muss den Antrag dann verwerfen, sonst erfährt die
 * genehmigende Person nichts davon.
 * @param {string} requesterAccountId Antragsteller (wird von Jira als Melder eingetragen)
 * @param {{startDate: string, endDate: string, comment: string|null, approverAccountId: string}} vacation
 * @returns {Promise<string>} Key des angelegten Issues, z. B. 'URLAUB-42'
 */
export const createApprovalIssue = async (requesterAccountId, vacation) => {
  const fields = {
    ...readConfig(),
    summary: `Urlaubsantrag ${formatRange(vacation)}`,
    assignee: { accountId: vacation.approverAccountId },
    description: doc(
      paragraph(mention(requesterAccountId), text(' hat Urlaub beantragt und dich als genehmigende Person eingetragen.')),
      paragraph(text('Zeitraum: ', true), text(formatRange(vacation))),
      vacation.comment && paragraph(text('Kommentar: ', true), text(vacation.comment)),
      paragraph(text('Bitte genehmige oder lehne den Antrag in Jira unter Apps → „Volkswohl Bund Reporting“ im Bereich „Zu genehmigen“ ab. '
        + 'Dieses Issue wird danach automatisch kommentiert und erledigt.')),
    ),
  };
  const { key } = await jiraRequest(route`/rest/api/3/issue`, 'POST', { fields });
  return key;
};

/**
 * Meldet eine Änderung des Antrags durch den Antragsteller: ggf. neuen
 * Genehmiger zuweisen, ein bereits erledigtes Issue wieder öffnen und die
 * neuen Daten kommentieren.
 * @param {string} issueKey
 * @param {{startDate: string, endDate: string, comment: string|null, approverAccountId: string}} vacation Neue Daten
 * @param {{approverChanged: boolean, wasDecided: boolean}} change
 * @returns {Promise<void>}
 */
export const notifyRequestChanged = (issueKey, vacation, { approverChanged, wasDecided }) =>
  updateIssueSafely(issueKey, 'Antrag geändert', async () => {
    if (approverChanged) {
      await jiraRequest(route`/rest/api/3/issue/${issueKey}/assignee`, 'PUT', { accountId: vacation.approverAccountId });
    }
    if (wasDecided) await transitionToCategory(issueKey, CATEGORIES_OPEN);
    await addComment(
      issueKey,
      paragraph(text('Der Antrag wurde geändert und muss erneut entschieden werden.', true)),
      paragraph(text('Zeitraum: ', true), text(formatRange(vacation))),
      vacation.comment && paragraph(text('Kommentar: ', true), text(vacation.comment)),
    );
  });

/**
 * Dokumentiert die Entscheidung der genehmigenden Person und erledigt das Issue.
 * @param {string} issueKey
 * @param {{approved: boolean, decisionComment: string|null}} decision
 * @returns {Promise<void>}
 */
export const notifyDecision = (issueKey, { approved, decisionComment }) =>
  updateIssueSafely(issueKey, 'Entscheidung', async () => {
    await addComment(
      issueKey,
      paragraph(text(approved ? 'Der Urlaubsantrag wurde genehmigt.' : 'Der Urlaubsantrag wurde abgelehnt.', true)),
      decisionComment && paragraph(text('Begründung: ', true), text(decisionComment)),
    );
    await transitionToCategory(issueKey, [CATEGORY_DONE]);
  });

/**
 * Dokumentiert die Stornierung durch den Antragsteller. Ein noch offenes
 * Issue wird zusätzlich erledigt, damit es nicht mehr als Aufgabe erscheint.
 * @param {string} issueKey
 * @param {{wasPending: boolean}} state
 * @returns {Promise<void>}
 */
export const notifyCancelled = (issueKey, { wasPending }) =>
  updateIssueSafely(issueKey, 'Stornierung', async () => {
    await addComment(issueKey, paragraph(text('Der Urlaubsantrag wurde vom Antragsteller storniert.', true)));
    if (wasPending) await transitionToCategory(issueKey, [CATEGORY_DONE]);
  });
