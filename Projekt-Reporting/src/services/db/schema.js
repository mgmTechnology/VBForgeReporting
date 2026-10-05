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

const migrations = migrationRunner
  .enqueue('v001_create_team', CREATE_TEAM_TABLE)
  .enqueue('v002_create_team_member', CREATE_TEAM_MEMBER_TABLE)
  .enqueue('v003_create_vacation', CREATE_VACATION_TABLE);

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
