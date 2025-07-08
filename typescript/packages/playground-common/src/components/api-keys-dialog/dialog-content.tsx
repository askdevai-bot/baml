'use client';

import React from 'react';
import { AddApiKeyForm } from './add-api-key-form';
import { ImportApiKeyDialog } from './import-api-key-dialog';
import { ApiKeysList } from './api-keys-list';
import { SaveActionsFooter } from './save-actions-footer';
import { useAtomValue } from 'jotai';
import { envKeyValueStorage, userApiKeysAtom } from './atoms';
import { useApiKeysState } from './use-api-keys-state';

export const ApiKeysDialogContent: React.FC = () => {
  // Debug values
  const envKeyValues = useAtomValue(envKeyValueStorage);
  const userApiKeys = useAtomValue(userApiKeysAtom);
  const { refreshFromStorage } = useApiKeysState();
  const [debugRefresh, setDebugRefresh] = React.useState(0);

  // Direct localStorage check
  const localStorageData = React.useMemo(() => {
    if (typeof window === 'undefined') return { data: null, allKeys: [] };
    try {
      const raw = window.localStorage.getItem('env-key-values');
      const allKeys = Object.keys(window.localStorage).filter(k =>
        k.includes('env') || k.includes('key') || k.includes('api')
      );

      // Get all relevant localStorage items
      const allData: Record<string, any> = {};
      allKeys.forEach(key => {
        try {
          const value = window.localStorage.getItem(key);
          allData[key] = value ? JSON.parse(value) : value;
        } catch {
          allData[key] = window.localStorage.getItem(key); // Keep as string if not JSON
        }
      });

      return {
        data: raw ? JSON.parse(raw) : null,
        allKeys,
        allData
      };
    } catch (e) {
      return { data: `Error parsing: ${e}`, allKeys: [], allData: {} };
    }
  }, [debugRefresh]);

  console.log('ApiKeysDialogContent - localStorage analysis:', localStorageData);
  console.log('ApiKeysDialogContent - envKeyValueStorage:', envKeyValues);
  console.log('ApiKeysDialogContent - userApiKeysAtom:', userApiKeys);

  return (
      <div className="space-y-2 max-h-[80vh] overflow-y-auto">
        {/* Debug Section */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-4 rounded-md border border-red-500 text-xs font-mono overflow-auto">
            <h4 className="font-bold mb-2 font-sans">Debug Info:</h4>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setDebugRefresh(prev => prev + 1)}
                className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-sans"
              >
                Refresh Debug Info
              </button>
              <button
                onClick={() => {
                  console.log('Adding test API keys');
                  const testKeys = [
                    ['OPENAI_API_KEY', 'sk-test-openai-key'],
                    ['ANTHROPIC_API_KEY', 'sk-test-anthropic-key']
                  ];
                  // Manually set to localStorage
                  window.localStorage.setItem('env-key-values', JSON.stringify(testKeys));
                  setDebugRefresh(prev => prev + 1);
                  // Force reload the dialog
                  window.location.reload();
                }}
                className="px-2 py-1 bg-green-500 text-white rounded text-xs font-sans"
              >
                Add Test Keys
              </button>
              <button
                onClick={() => {
                  console.log('Clearing localStorage');
                  window.localStorage.removeItem('env-key-values');
                  setDebugRefresh(prev => prev + 1);
                }}
                className="px-2 py-1 bg-red-500 text-white rounded text-xs font-sans"
              >
                Clear Storage
              </button>
              <button
                onClick={() => {
                  console.log('Manually refreshing from storage');
                  refreshFromStorage();
                  setDebugRefresh(prev => prev + 1);
                }}
                className="px-2 py-1 bg-purple-500 text-white rounded text-xs font-sans"
              >
                Refresh from Storage
              </button>
            </div>
            <div className="mb-2">
              <strong>localStorage['env-key-values']:</strong>
              <pre>{localStorageData.data === null ? 'null' : JSON.stringify(localStorageData.data, null, 2)}</pre>
            </div>
            <div className="mb-2">
              <strong>Related localStorage keys:</strong>
              <pre>{JSON.stringify(localStorageData.allKeys, null, 2)}</pre>
            </div>
            <div className="mb-2">
              <strong>All related localStorage data:</strong>
              <pre className="max-h-32 overflow-auto">{JSON.stringify(localStorageData.allData, null, 2)}</pre>
            </div>
            <div className="mb-2">
              <strong>envKeyValueStorage:</strong>
              <pre>{JSON.stringify(envKeyValues, null, 2)}</pre>
            </div>
            <div>
              <strong>userApiKeysAtom:</strong>
              <pre>{JSON.stringify(userApiKeys, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Add New Api Key Form */}
        <div className="mb-4 p-4 rounded-md border border-border flex flex-col gap-2">
          <AddApiKeyForm/>

          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground mt-2 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <ImportApiKeyDialog  />
              <span>or paste the .env contents above</span>
            </div>
            <SaveActionsFooter />
          </div>
        </div>

        {/* Env Vars List */}
          <ApiKeysList />
      </div>
  );
};