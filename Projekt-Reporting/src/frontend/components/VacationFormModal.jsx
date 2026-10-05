import React, { useState } from 'react';
import {
  Button, DatePicker, ErrorMessage, Label, LoadingButton, Modal, ModalBody, ModalFooter,
  ModalHeader, ModalTitle, Stack, Text, Textfield,
} from '@forge/react';
import { countWorkdays } from '../utils/dateUtils';
import { useAsyncAction } from '../hooks/useAsyncAction';

const ID = (suffix) => `vacation-form-${suffix}`;

/**
 * Schnelle Vorab-Prüfung im Frontend (das Backend prüft verbindlich erneut).
 * @param {string} startDate
 * @param {string} endDate
 * @returns {string|null} Fehlermeldung oder null
 */
const validate = (startDate, endDate) => {
  if (!startDate || !endDate) return 'Bitte Start- und Enddatum angeben.';
  if (endDate < startDate) return 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  return null;
};

/**
 * Modal zum Anlegen oder Bearbeiten eines eigenen Urlaubs.
 * Bleibt bei einem Speicherfehler offen und zeigt die Meldung des Backends.
 *
 * @param {object} props
 * @param {object|null} props.vacation Zu bearbeitender Urlaub oder null für "neu"
 * @param {(vacation: object) => Promise<void>} props.onSave
 * @param {() => void} props.onClose
 */
export const VacationFormModal = ({ vacation, onSave, onClose }) => {
  const [startDate, setStartDate] = useState(vacation?.startDate ?? '');
  const [endDate, setEndDate] = useState(vacation?.endDate ?? '');
  const [comment, setComment] = useState(vacation?.comment ?? '');
  const { busy, error, setError, run } = useAsyncAction();

  const handleSave = () => {
    const validationError = validate(startDate, endDate);
    if (validationError) return setError(validationError);
    return run(() => onSave({ id: vacation?.id, startDate, endDate, comment }), onClose);
  };

  return (
    <Modal onClose={onClose} testId={ID('modal')}>
      <ModalHeader>
        <ModalTitle>{vacation ? 'Urlaub bearbeiten' : 'Urlaub eintragen'}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.150" testId={ID('body')}>
          <Label labelFor={ID('start')}>Von</Label>
          <DatePicker id={ID('start')} testId={ID('start')} value={startDate} onChange={setStartDate} />
          <Label labelFor={ID('end')}>Bis</Label>
          <DatePicker id={ID('end')} testId={ID('end')} value={endDate} onChange={setEndDate} />
          <Label labelFor={ID('comment')}>Kommentar (optional)</Label>
          <Textfield id={ID('comment')} testId={ID('comment')} value={comment} maxLength={500}
            onChange={(event) => setComment(event.target.value)} />
          {startDate && endDate && endDate >= startDate && (
            <Text testId={ID('workdays')}>{countWorkdays(startDate, endDate)} Arbeitstage</Text>
          )}
          {error && <ErrorMessage testId={ID('error')}>{error}</ErrorMessage>}
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button appearance="subtle" onClick={onClose} isDisabled={busy} testId={ID('cancel')}>Abbrechen</Button>
        <LoadingButton appearance="primary" onClick={handleSave} isLoading={busy} testId={ID('save')}>Speichern</LoadingButton>
      </ModalFooter>
    </Modal>
  );
};
