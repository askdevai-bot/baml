import React from 'react';
import { Button } from '@baml/ui/button';
import { Save, Loader2 } from 'lucide-react';
import { useAtom } from 'jotai';
import { pendingApiKeyRowsAtom } from './atoms';
import { useApiKeysState } from './use-api-keys-state';

export const SaveActionsFooter: React.FC = () => {
  const {
    isSaving,
    hasLocalChanges,
    saveChanges,
    addApiKey,
  } = useApiKeysState();
  const [pendingRows, setPendingRows] = useAtom(pendingApiKeyRowsAtom);

  // Only enable if there are valid unsaved rows or hasLocalChanges
  const hasValidPending = pendingRows.some(row => row.key.trim() !== '');
  const isDisabled = isSaving || (!hasLocalChanges && !hasValidPending);

  const handleSave = async () => {
    console.log('SaveActionsFooter: Starting save, pending rows:', pendingRows);

    // Add all valid pending rows
    pendingRows.forEach(({ key, value }) => {
      if (key.trim() !== '') {
        console.log('SaveActionsFooter: Adding API key:', key);
        addApiKey(key, value);
      }
    });
    setPendingRows([{ key: '', value: '' }]); // Reset form

    console.log('SaveActionsFooter: Calling saveChanges...');
    await saveChanges();
    console.log('SaveActionsFooter: Save completed');
  };

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={handleSave}
      className="gap-2"
      disabled={isDisabled}
    >
      {isSaving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Save className="w-4 h-4" />
      )}
      {isSaving ? 'Saving...' : hasLocalChanges || hasValidPending ? 'Save' : 'Saved'}
    </Button>
  );
};