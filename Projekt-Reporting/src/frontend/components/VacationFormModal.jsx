import React, { useState } from 'react';
import {
  Button, DatePicker, ErrorMessage, Label, LoadingButton, Modal, ModalBody, ModalFooter,
  ModalHeader, ModalTitle, SectionMessage, Stack, Text, Textfield, UserPicker,
} from '@forge/react';
import { countWorkdays } from '../utils/dateUtils';
import { STATUS_PENDING } from '../utils/vacationStatus';
import { useAsyncAction } from '../hooks/useAsyncAction';

const ID = (suffix) => `vacation-form-${suffix}`;

/**
 * Schnelle Vorab-Prüfung im Frontend (das Backend prüft verbindlich erneut).
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} approverAccountId
 * @param {string} currentAccountId
 * @returns {string|null} Fehlermeldung oder null
 */
const validate = (startDate, endDate, approverAccountId, currentAccountId) => {
  if (!startDate || !endDate) return 'Bitte Start- und Enddatum angeben.';
  if (endDate < startDate) return 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  if (!approverAccountId) return 'Bitte eine genehmigende Person auswählen.';
  if (approverAccountId === currentAccountId) return 'Du kannst deinen eigenen Urlaub nicht selbst genehmigen.';
  return null;
};

/**
 * Modal zum Beantragen oder Bearbeiten eines eigenen Urlaubs inkl. Auswahl
 * der genehmigenden Person. Bleibt bei einem Speicherfehler offen und zeigt
 * die Meldung des Backends (z. B. wenn Jira das Genehmigungs-Issue ablehnt).
 *
 * @param {object} props
 * @param {object|null} props.vacation Zu bearbeitender Urlaub oder null für "neu"
 * @param {string} props.currentAccountId accountId des angemeldeten Users
 * @param {(vacation: object) => Promise<void>} props.onSave
 * @param {() => void} props.onClose
 */
export const VacationFormModal = ({ vacation, currentAccountId, onSave, onClose }) => {
  const [startDate, setStartDate] = useState(vacation?.startDate ?? '');
  const [endDate, setEndDate] = useState(vacation?.endDate ?? '');
  const [comment, setComment] = useState(vacation?.comment ?? '');
  const [approverAccountId, setApproverAccountId] = useState(vacation?.approverAccountId ?? '');
  const { busy, error, setError, run } = useAsyncAction();
  // Ein bereits entschiedener Antrag muss nach jeder Änderung erneut genehmigt werden
  const needsReapproval = Boolean(vacation) && vacation.status !== STATUS_PENDING;

  const handleSave = () => {
    const validationError = validate(startDate, endDate, approverAccountId, currentAccountId);
    if (validationError) return setError(validationError);
    return run(() => onSave({ id: vacation?.id, startDate, endDate, comment, approverAccountId }), onClose);
  };

  return (
    <Modal onClose={onClose} testId={ID('modal')}>
      <ModalHeader>
        <ModalTitle>{vacation ? 'Urlaubsantrag bearbeiten' : 'Urlaub beantragen'}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.150" testId={ID('body')}>
          {needsReapproval && (
            <SectionMessage appearance="warning" testId={ID('reapproval')}>
              <Text>Dieser Antrag ist bereits entschieden. Nach dem Speichern muss er erneut genehmigt werden.</Text>
            </SectionMessage>
          )}
          <Label labelFor={ID('start')}>Von</Label>
          <DatePicker id={ID('start')} testId={ID('start')} value={startDate} onChange={setStartDate} />
          <Label labelFor={ID('end')}>Bis</Label>
          <DatePicker id={ID('end')} testId={ID('end')} value={endDate} onChange={setEndDate} />
          <Label labelFor={ID('comment')}>Kommentar (optional)</Label>
          <Textfield id={ID('comment')} testId={ID('comment')} value={comment} maxLength={500}
            onChange={(event) => setComment(event.target.value)} />
          {/* UserPicker liefert { id, name, ... } des gewählten Jira-Users; beim Leeren kein Objekt */}
          <UserPicker label="Genehmigende Person" name={ID('approver')} placeholder="Jira-User suchen …" isRequired
            defaultValue={vacation?.approverAccountId ?? undefined}
            description="Diese Person erhält ein Jira-Issue und entscheidet über den Antrag."
            onChange={(user) => setApproverAccountId(user?.id ?? '')} />
          {startDate && endDate && endDate >= startDate && (
            <Text testId={ID('workdays')}>{countWorkdays(startDate, endDate)} Arbeitstage</Text>
          )}
          {error && <ErrorMessage testId={ID('error')}>{error}</ErrorMessage>}
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button appearance="subtle" onClick={onClose} isDisabled={busy} testId={ID('cancel')}>Abbrechen</Button>
        <LoadingButton appearance="primary" onClick={handleSave} isLoading={busy} testId={ID('save')}>
          {vacation ? 'Speichern' : 'Beantragen'}
        </LoadingButton>
      </ModalFooter>
    </Modal>
  );
};
