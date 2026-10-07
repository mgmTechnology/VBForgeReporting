/**
 * Status eines Urlaubsantrags und seine Darstellung in der Oberfläche.
 * Die Werte entsprechen der Spalte vacation.status im Backend.
 */

export const STATUS_PENDING = 'PENDING';
export const STATUS_APPROVED = 'APPROVED';
export const STATUS_REJECTED = 'REJECTED';

/** Beschriftung und Lozenge-Farbe je Status (moved = gelb, success = grün, removed = rot). */
const STATUS_DISPLAY = {
  [STATUS_PENDING]: { label: 'Beantragt', appearance: 'moved' },
  [STATUS_APPROVED]: { label: 'Genehmigt', appearance: 'success' },
  [STATUS_REJECTED]: { label: 'Abgelehnt', appearance: 'removed' },
};

/**
 * Liefert Beschriftung und Lozenge-Farbe für einen Status.
 * @param {string} status
 * @returns {{label: string, appearance: string}}
 */
export const getStatusDisplay = (status) => STATUS_DISPLAY[status] ?? { label: status, appearance: 'default' };
