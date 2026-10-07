import { migrationRunner } from '@forge/sql';

/*
 * Datenbankschema der Urlaubsplanung (Forge SQL, MySQL-kompatibel).
 *
 * Wichtig: Bereits ausgerollte Migrationen NIE ändern, sondern immer eine
 * neue Migration mit neuem Namen anhängen. Der migrationRunner merkt sich in
 * der Tabelle __migrations, welche Namen schon ausgeführt wurden.
 */

/** Teams: jeder User darf Teams anlegen und ist dann alleiniger Owner. */
const CREATE_TEAM_TABLE = `
  CREATE TABLE IF NOT EXISTS team (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    owner_account_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_team_owner (owner_account_id)
  )`;

/** n:m-Zuordnung Team <-> Jira-User. Der Owner ist immer auch Mitglied. */
const CREATE_TEAM_MEMBER_TABLE = `
  CREATE TABLE IF NOT EXISTS team_member (
    team_id BIGINT NOT NULL,
    account_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, account_id),
    INDEX idx_team_member_account (account_id)
  )`;

/** Urlaube hängen am User, nicht am Team – sie erscheinen in allen seinen Teams. */
const CREATE_VACATION_TABLE = `
  CREATE TABLE IF NOT EXISTS vacation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    account_id VARCHAR(128) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    comment VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vacation_account_dates (account_id, start_date, end_date)
  )`;

/*
 * Genehmigungs-Workflow (v004–v009): Jeder Urlaub bekommt einen Status und
 * eine genehmigende Person. Bestehende Urlaube gelten als genehmigt
 * (DEFAULT 'APPROVED'); neue Anträge setzt der Service explizit auf 'PENDING'.
 * Je Migration nur eine Änderung, damit ein Fehler eindeutig zuzuordnen ist.
 */

/** Status: 'PENDING' (beantragt), 'APPROVED' (genehmigt), 'REJECTED' (abgelehnt). */
const ADD_VACATION_STATUS = `
  ALTER TABLE vacation ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'APPROVED'`;

/** accountId der Person, die den Antrag genehmigen soll. */
const ADD_VACATION_APPROVER = `
  ALTER TABLE vacation ADD COLUMN approver_account_id VARCHAR(128) NULL`;

/** Zeitpunkt der Entscheidung (NULL, solange der Antrag offen ist). */
const ADD_VACATION_DECIDED_AT = `
  ALTER TABLE vacation ADD COLUMN decided_at TIMESTAMP NULL`;

/** Optionale Begründung der genehmigenden Person. */
const ADD_VACATION_DECISION_COMMENT = `
  ALTER TABLE vacation ADD COLUMN decision_comment VARCHAR(500) NULL`;

/** Key des Jira-Issues, über das der Genehmiger benachrichtigt wird (z. B. 'URLAUB-42'). */
const ADD_VACATION_JIRA_ISSUE_KEY = `
  ALTER TABLE vacation ADD COLUMN jira_issue_key VARCHAR(32) NULL`;

/** Für die Liste „Zu genehmigen“ des Genehmigers. */
const ADD_VACATION_APPROVER_INDEX = `
  CREATE INDEX idx_vacation_approver_status ON vacation (approver_account_id, status)`;

const migrations = migrationRunner
  .enqueue('v001_create_team', CREATE_TEAM_TABLE)
  .enqueue('v002_create_team_member', CREATE_TEAM_MEMBER_TABLE)
  .enqueue('v003_create_vacation', CREATE_VACATION_TABLE)
  .enqueue('v004_add_vacation_status', ADD_VACATION_STATUS)
  .enqueue('v005_add_vacation_approver', ADD_VACATION_APPROVER)
  .enqueue('v006_add_vacation_decided_at', ADD_VACATION_DECIDED_AT)
  .enqueue('v007_add_vacation_decision_comment', ADD_VACATION_DECISION_COMMENT)
  .enqueue('v008_add_vacation_jira_issue_key', ADD_VACATION_JIRA_ISSUE_KEY)
  .enqueue('v009_add_vacation_approver_index', ADD_VACATION_APPROVER_INDEX);

// Merkt sich pro Funktionsinstanz, dass das Schema bereits geprüft wurde
let schemaReady = null;

/**
 * Stellt sicher, dass alle Migrationen gelaufen sind. Wird vor jedem
 * Datenzugriff aufgerufen; nach dem ersten Erfolg kostet das nichts mehr.
 * Bei einem Fehler wird beim nächsten Aufruf erneut versucht.
 * @returns {Promise<string[]>} Namen der in diesem Lauf ausgeführten Migrationen
 */
export const ensureSchema = () => {
  if (!schemaReady) {
    schemaReady = migrations.run().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
};
