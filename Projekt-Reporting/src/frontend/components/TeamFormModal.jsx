import React, { useState } from 'react';
import {
  Button, ErrorMessage, Inline, Label, LoadingButton, Lozenge, Modal, ModalBody, ModalFooter,
  ModalHeader, ModalTitle, SectionMessage, Stack, Text, Textfield, User, UserPicker,
} from '@forge/react';
import { useAsyncAction } from '../hooks/useAsyncAction';

const ID = (suffix) => `team-form-${suffix}`;

/**
 * Eine Zeile der Mitgliederliste. Der Owner kann nicht entfernt werden.
 * @param {object} props
 * @param {string} props.accountId
 * @param {boolean} props.isOwner
 * @param {(accountId: string) => void} props.onRemove
 */
const MemberRow = ({ accountId, isOwner, onRemove }) => (
  <Inline spread="space-between" alignBlock="center" testId={ID(`member-${accountId}`)}>
    <User accountId={accountId} />
    {isOwner
      ? <Lozenge appearance="new" testId={ID(`member-${accountId}-owner`)}>Owner</Lozenge>
      : <Button appearance="subtle" onClick={() => onRemove(accountId)} testId={ID(`member-${accountId}-remove`)}>Entfernen</Button>}
  </Inline>
);

/**
 * Footer im Normalzustand bzw. als Lösch-Bestätigung.
 * @param {object} props
 */
const TeamFormFooter = ({ canDelete, confirmingDelete, busy, onClose, onSave, onAskDelete, onCancelDelete, onDelete }) => (confirmingDelete
  ? (
    <ModalFooter>
      <Button appearance="subtle" onClick={onCancelDelete} isDisabled={busy} testId={ID('delete-cancel')}>Nicht löschen</Button>
      <LoadingButton appearance="danger" onClick={onDelete} isLoading={busy} testId={ID('delete-confirm')}>Endgültig löschen</LoadingButton>
    </ModalFooter>
  ) : (
    <ModalFooter>
      {canDelete && <Button appearance="danger" onClick={onAskDelete} isDisabled={busy} testId={ID('delete')}>Team löschen</Button>}
      <Button appearance="subtle" onClick={onClose} isDisabled={busy} testId={ID('cancel')}>Abbrechen</Button>
      <LoadingButton appearance="primary" onClick={onSave} isLoading={busy} testId={ID('save')}>Speichern</LoadingButton>
    </ModalFooter>
  ));

/**
 * Modal zum Anlegen, Bearbeiten und Löschen eines eigenen Teams.
 * Mitglieder werden über den UserPicker (Jira-User) hinzugefügt.
 *
 * @param {object} props
 * @param {object|null} props.team Zu bearbeitendes Team oder null für "neu"
 * @param {string} props.currentAccountId accountId des angemeldeten Users (= Owner)
 * @param {(team: object) => Promise<void>} props.onSave
 * @param {(teamId: string) => Promise<void>} props.onDelete
 * @param {() => void} props.onClose
 */
export const TeamFormModal = ({ team, currentAccountId, onSave, onDelete, onClose }) => {
  const [name, setName] = useState(team?.name ?? '');
  const [memberIds, setMemberIds] = useState(team?.memberAccountIds ?? [currentAccountId]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { busy, error, setError, run } = useAsyncAction();
  const ownerId = team?.ownerAccountId ?? currentAccountId;

  // UserPicker liefert { id, name, ... } des gewählten Jira-Users
  const addMember = (user) => user && !memberIds.includes(user.id) && setMemberIds([...memberIds, user.id]);
  const removeMember = (accountId) => setMemberIds(memberIds.filter((id) => id !== accountId));

  const handleSave = () => {
    if (!name.trim()) return setError('Bitte einen Teamnamen angeben.');
    return run(() => onSave({ id: team?.id, name: name.trim(), memberAccountIds: memberIds }), onClose);
  };

  return (
    <Modal onClose={onClose} testId={ID('modal')}>
      <ModalHeader>
        <ModalTitle>{team ? `Team „${team.name}“ bearbeiten` : 'Neues Team anlegen'}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.150" testId={ID('body')}>
          {confirmingDelete && (
            <SectionMessage appearance="warning" title="Team wirklich löschen?" testId={ID('delete-warning')}>
              <Text>Das Team und alle Mitgliedschaften werden gelöscht. Die Urlaube der Mitglieder bleiben erhalten.</Text>
            </SectionMessage>
          )}
          <Label labelFor={ID('name')}>Teamname</Label>
          <Textfield id={ID('name')} testId={ID('name')} value={name} maxLength={100}
            onChange={(event) => setName(event.target.value)} />
          <UserPicker label="Mitglied hinzufügen" name={ID('user-picker')} placeholder="Jira-User suchen …" onChange={addMember} />
          <Text testId={ID('member-count')}>Mitglieder ({memberIds.length})</Text>
          {memberIds.map((accountId) => (
            <MemberRow key={accountId} accountId={accountId} isOwner={accountId === ownerId} onRemove={removeMember} />
          ))}
          {error && <ErrorMessage testId={ID('error')}>{error}</ErrorMessage>}
        </Stack>
      </ModalBody>
      <TeamFormFooter canDelete={Boolean(team)} confirmingDelete={confirmingDelete} busy={busy}
        onClose={onClose} onSave={handleSave} onAskDelete={() => setConfirmingDelete(true)}
        onCancelDelete={() => setConfirmingDelete(false)} onDelete={() => run(() => onDelete(team.id), onClose)} />
    </Modal>
  );
};
