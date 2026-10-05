import React from 'react';
import {
  Button, ErrorMessage, LoadingButton, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, Stack, Text,
} from '@forge/react';
import { useAsyncAction } from '../hooks/useAsyncAction';

/**
 * Allgemeiner Bestätigungsdialog für destruktive Aktionen.
 *
 * @param {object} props
 * @param {string} props.title Überschrift
 * @param {string} props.message Erläuterung
 * @param {string} props.confirmLabel Beschriftung des Bestätigen-Buttons
 * @param {() => Promise<void>} props.onConfirm
 * @param {() => void} props.onClose
 * @param {string} props.idPrefix Präfix für eindeutige IDs
 */
export const ConfirmModal = ({ title, message, confirmLabel, onConfirm, onClose, idPrefix }) => {
  const { busy, error, run } = useAsyncAction();
  const id = (suffix) => `${idPrefix}-${suffix}`;

  return (
    <Modal onClose={onClose} testId={id('modal')}>
      <ModalHeader>
        <ModalTitle appearance="danger">{title}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.100" testId={id('body')}>
          <Text>{message}</Text>
          {error && <ErrorMessage testId={id('error')}>{error}</ErrorMessage>}
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button appearance="subtle" onClick={onClose} isDisabled={busy} testId={id('cancel')}>Abbrechen</Button>
        <LoadingButton appearance="danger" onClick={() => run(onConfirm, onClose)} isLoading={busy} testId={id('confirm')}>
          {confirmLabel}
        </LoadingButton>
      </ModalFooter>
    </Modal>
  );
};
