import React, { useState } from 'react';
import {
  Button, ErrorMessage, Label, LoadingButton, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle,
  Stack, Text, Textfield, User,
} from '@forge/react';
import { countWorkdays, formatRange } from '../utils/dateUtils';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { STATUS_APPROVED, STATUS_REJECTED } from '../utils/vacationStatus';

const ID = (suffix) => `decision-${suffix}`;

/**
 * Modal, in dem die genehmigende Person einen Antrag genehmigt oder ablehnt.
 * Die Begründung ist optional und wird dem Antragsteller angezeigt sowie
 * als Kommentar am Jira-Issue vermerkt.
 *
 * @param {object} props
 * @param {object} props.vacation Offener Antrag
 * @param {(vacationId: string, decision: string, comment: string) => Promise<void>} props.onDecide
 * @param {() => void} props.onClose
 */
export const DecisionModal = ({ vacation, onDecide, onClose }) => {
  const [comment, setComment] = useState('');
  // Merkt sich, welcher Button gedrückt wurde, damit nur dieser den Ladezustand zeigt
  const [pendingDecision, setPendingDecision] = useState(null);
  const { busy, error, run } = useAsyncAction();

  const decide = (decision) => {
    setPendingDecision(decision);
    return run(() => onDecide(vacation.id, decision, comment), onClose);
  };

  return (
    <Modal onClose={onClose} testId={ID('modal')}>
      <ModalHeader>
        <ModalTitle>Urlaubsantrag entscheiden</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.150" testId={ID('body')}>
          <User accountId={vacation.accountId} />
          <Text>
            {formatRange(vacation.startDate, vacation.endDate)} · {countWorkdays(vacation.startDate, vacation.endDate)} Arbeitstage
          </Text>
          {vacation.comment && <Text>Kommentar: {vacation.comment}</Text>}
          <Label labelFor={ID('comment')}>Begründung (optional)</Label>
          <Textfield id={ID('comment')} testId={ID('comment')} value={comment} maxLength={500}
            onChange={(event) => setComment(event.target.value)} />
          {error && <ErrorMessage testId={ID('error')}>{error}</ErrorMessage>}
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button appearance="subtle" onClick={onClose} isDisabled={busy} testId={ID('cancel')}>Abbrechen</Button>
        <LoadingButton appearance="danger" onClick={() => decide(STATUS_REJECTED)} testId={ID('reject')}
          isLoading={busy && pendingDecision === STATUS_REJECTED} isDisabled={busy}>Ablehnen</LoadingButton>
        <LoadingButton appearance="primary" onClick={() => decide(STATUS_APPROVED)} testId={ID('approve')}
          isLoading={busy && pendingDecision === STATUS_APPROVED} isDisabled={busy}>Genehmigen</LoadingButton>
      </ModalFooter>
    </Modal>
  );
};
