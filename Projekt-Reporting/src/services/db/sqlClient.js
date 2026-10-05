import { sql } from '@forge/sql';

/*
 * Dünne Hülle um Forge SQL, damit die Services nicht überall
 * sql.prepare(...).bindParams(...).execute() wiederholen müssen.
 * Forge SQL unterstützt nur positionale Parameter (?).
 */

/**
 * Führt ein Prepared Statement aus.
 * Bei SELECT ist das Ergebnis ein Array von Zeilen, bei INSERT/UPDATE/DELETE
 * ein Objekt mit Metadaten wie insertId und affectedRows.
 * @param {string} query SQL mit ?-Platzhaltern
 * @param {...unknown} params Werte für die Platzhalter
 * @returns {Promise<Array<object>|{insertId: number, affectedRows: number}>}
 */
export const execute = async (query, ...params) => {
  const result = await sql.prepare(query).bindParams(...params).execute();
  return result.rows;
};

/**
 * Erzeugt eine Platzhalterliste für IN-Klauseln, z. B. "?, ?, ?".
 * @param {number} count
 * @returns {string}
 */
export const placeholders = (count) => Array(count).fill('?').join(', ');
