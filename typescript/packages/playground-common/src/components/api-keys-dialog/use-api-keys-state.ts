import { useState, useCallback, useTransition, useEffect, useMemo } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  requiredApiKeysAtom,
  userApiKeysAtom,
} from './atoms';
import { apiKeyVisibilityAtom, type ApiKeyEntry } from './atoms';

export function useApiKeysState() {
  const [userApiKeys, setUserApiKeys] = useAtom(userApiKeysAtom);
  const requiredApiKeys = useAtomValue(requiredApiKeysAtom);
  const visibility = useAtomValue(apiKeyVisibilityAtom);
  const setVisibility = useSetAtom(apiKeyVisibilityAtom);
  const [, startTransition] = useTransition();

  // Local state for all environment variables to avoid triggering runtime updates on every change
  const [localApiKeys, setLocalApiKeys] = useState<Record<string, string>>({});
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Track newly added variables to display them at the top
  const [recentlyAddedKeys, setRecentlyAddedKeys] = useState<Set<string>>(new Set());
  // Add a flag to prevent re-initialization right after save
  const [justSaved, setJustSaved] = useState(false);
  // Track if we've initialized from storage
  const [hasInitialized, setHasInitialized] = useState(false);

  // Force refresh localApiKeys from userApiKeys
  const refreshFromStorage = useCallback(() => {
    console.log('useApiKeysState: Force refreshing from storage, userApiKeys:', userApiKeys);
    setLocalApiKeys(userApiKeys);
    setHasLocalChanges(false);
  }, [userApiKeys]);

  // Initialize local state from global state
  useEffect(() => {
    console.log('useApiKeysState useEffect triggered:', {
      hasLocalChanges,
      justSaved,
      hasInitialized,
      userApiKeys,
      localApiKeys,
      localApiKeysLength: Object.keys(localApiKeys).length,
      userApiKeysLength: Object.keys(userApiKeys).length
    });

    // Always initialize on first render
    if (!hasInitialized) {
      console.log('useApiKeysState: Initial load, setting localApiKeys from userApiKeys:', userApiKeys);
      setLocalApiKeys(userApiKeys);
      setHasInitialized(true);
      return;
    }

    // Sync when no local changes and not just saved
    if (!hasLocalChanges && !justSaved) {
      console.log('useApiKeysState: Resetting localApiKeys from userApiKeys:', userApiKeys);
      setLocalApiKeys(userApiKeys);
    } else if (justSaved) {
      console.log('useApiKeysState: Just saved, not resetting localApiKeys');
      // Reset the flag after the effect runs once
      setJustSaved(false);
    } else if (hasLocalChanges) {
      console.log('useApiKeysState: Not syncing because hasLocalChanges:', hasLocalChanges);
    }
  }, [userApiKeys, hasLocalChanges, justSaved, hasInitialized]);

  // Compute rendered env vars locally to avoid atom recalculation
  const apiKeys = useMemo(() => {
    console.log('useApiKeysState: Computing apiKeys from localApiKeys:', localApiKeys);

    const vars: ApiKeyEntry[] = Object.entries(localApiKeys).map(
      ([key, value]) => ({
        key,
        value,
        required: requiredApiKeys.includes(key),
        hidden: visibility[key] !== true,
      }),
    );

    const missingVars = requiredApiKeys.filter(
      (apiKey) => !(apiKey in localApiKeys),
    );

    vars.push(
      ...missingVars.map((apiKey) => ({
        key: apiKey,
        value: undefined,
        required: true,
        hidden: visibility[apiKey] !== true,
      })),
    );

    // Sort with recently added keys at the top, then alphabetically
    const sorted = vars.sort((a, b) => {
      const aIsRecent = recentlyAddedKeys.has(a.key);
      const bIsRecent = recentlyAddedKeys.has(b.key);

      if (aIsRecent && !bIsRecent) return -1;
      if (!aIsRecent && bIsRecent) return 1;

      // If both are recent or both are not, sort alphabetically
      return a.key.localeCompare(b.key);
    });

    console.log('useApiKeysState: Computed apiKeys:', sorted);
    return sorted;
  }, [localApiKeys, requiredApiKeys, visibility, recentlyAddedKeys]);

  const toggleVisibility = useCallback((key: string) => {
    setVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, [setVisibility]);

  const updateApiKey = useCallback((key: string, value: string) => {
    setLocalApiKeys(prev => ({
      ...prev,
      [key]: value,
    }));
    setHasLocalChanges(true);
  }, []);

  const deleteApiKey = useCallback((key: string) => {
    setLocalApiKeys(prev => {
      const newVars = { ...prev };
      delete newVars[key];
      return newVars;
    });
    setHasLocalChanges(true);
    // Remove from recently added keys if it was there
    setRecentlyAddedKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
  }, []);

  const addApiKey = useCallback((key: string, value: string) => {
    console.log('useApiKeysState: Adding API key:', key, 'with value:', value);
    setLocalApiKeys(prev => {
      const newState = {
        ...prev,
        [key]: value,
      };
      console.log('useApiKeysState: New localApiKeys after add:', newState);
      return newState;
    });
    setHasLocalChanges(true);

    // Mark this key as recently added
    setRecentlyAddedKeys(prev => new Set([...prev, key]));
  }, []);

  const importApiKeys = useCallback((vars: Record<string, string>) => {
    const newKeys = Object.keys(vars);
    setLocalApiKeys(prev => ({
      ...prev,
      ...vars,
    }));
    setHasLocalChanges(true);
    // Mark imported keys as recently added
    setRecentlyAddedKeys(prev => new Set([...prev, ...newKeys]));
  }, []);

  const saveChanges = useCallback(async () => {
    console.log('useApiKeysState: Starting saveChanges with localApiKeys:', localApiKeys);
    setIsSaving(true);

    // Small delay to ensure UI updates immediately
    await new Promise(resolve => setTimeout(resolve, 0));

    startTransition(() => {
      console.log('useApiKeysState: Setting userApiKeys to:', localApiKeys);
      setUserApiKeys(localApiKeys);

      // Verify what's in localStorage after save
      setTimeout(() => {
        const saved = window.localStorage.getItem('env-key-values');
        console.log('useApiKeysState: After save, localStorage contains:', saved);
        try {
          console.log('useApiKeysState: Parsed localStorage:', JSON.parse(saved || '[]'));
        } catch (e) {
          console.error('useApiKeysState: Error parsing localStorage:', e);
        }
      }, 100);

      setHasLocalChanges(false);
      setJustSaved(true); // Set flag to prevent immediate re-initialization
      // Clear recently added keys after saving
      setRecentlyAddedKeys(new Set());
      // Reset saving state after a small delay to show completion
      setTimeout(() => {
        setIsSaving(false);
        console.log('useApiKeysState: Save complete, isSaving set to false');
      }, 200);
    });
  }, [localApiKeys, setUserApiKeys]);

  return {
    apiKeys,
    isSaving,
    hasLocalChanges,
    toggleVisibility,
    updateApiKey,
    deleteApiKey,
    addApiKey,
    importApiKeys,
    saveChanges,
    refreshFromStorage,
  };
}