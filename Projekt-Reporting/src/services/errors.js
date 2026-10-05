/**
 * Fachlicher Fehler, dessen Meldung gefahrlos an das Frontend gehen darf.
 * Alle anderen Fehler (z. B. SQL-Fehler) werden im Resolver geloggt und
 * nur als generische Meldung zurückgegeben.
 */
export class AppError extends Error {
  /**
   * @param {'VALIDATION'|'FORBIDDEN'|'NOT_FOUND'} code Maschinenlesbarer Fehlercode
   * @param {string} message Für Anwender verständliche Meldung (deutsch)
   */
  constructor(code, message) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

/**
 * Eingabe ist ungültig.
 * @param {string} message
 * @returns {AppError}
 */
export const validationError = (message) => new AppError('VALIDATION', message);

/**
 * Aufrufer hat keine Berechtigung für die Aktion.
 * @param {string} message
 * @returns {AppError}
 */
export const forbiddenError = (message) => new AppError('FORBIDDEN', message);

/**
 * Datensatz existiert nicht (oder ist für den Aufrufer nicht sichtbar).
 * @param {string} message
 * @returns {AppError}
 */
export const notFoundError = (message) => new AppError('NOT_FOUND', message);
