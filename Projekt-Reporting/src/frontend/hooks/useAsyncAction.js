import { useState } from 'react';

/**
 * Kapselt den Ablauf "Aktion ausführen, Ladezustand zeigen, Fehler anzeigen"
 * für Buttons in Modals. Bei Erfolg wird onSuccess aufgerufen (z. B. Modal schließen).
 *
 * @returns {{busy: boolean, error: string|null, setError: function, run: function}}
 */
export const useAsyncAction = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  /**
   * @param {() => Promise<unknown>} action
   * @param {() => void} [onSuccess]
   */
  const run = async (action, onSuccess) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setBusy(false);
      onSuccess?.();
    } catch (actionError) {
      setBusy(false);
      setError(actionError.message);
    }
  };

  return { busy, error, setError, run };
};
