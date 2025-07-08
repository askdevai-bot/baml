import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { vscodeLocalStorageStore } from '../../shared/baml-project-panel/Jotai';
import { vscode } from '../../shared/baml-project-panel/vscode';
import { proxyUrlAtom } from '../../shared/baml-project-panel/atoms';
import { runtimeAtom } from '../../shared/baml-project-panel/atoms';

export const apiKeyVisibilityAtom = atom<Record<string, boolean>>({});

export interface ApiKeyEntry {
  key: string;
  value: string | undefined;
  required: boolean;
  hidden: boolean;
}

const hasShownApiKeyDialogAtom = atomWithStorage(
  'has-closed-env-vars-dialog',
  false,
  vscodeLocalStorageStore,
);

const apiKeyDialogOpenAtom = atom(false);

export const showApiKeyDialogAtom = atom(
  (get) => {
    const apiKeyDialogOpen = get(apiKeyDialogOpenAtom)
    if (apiKeyDialogOpen) return true

    const requiredVars = get(requiredApiKeysAtom)
    const envVars = get(apiKeysAtom)

    // Check if ALL required vars are missing
    const hasMissingVars =
      requiredVars.length > 0 && requiredVars.every((key) => !envVars[key])

    const hasShownDialog = get(hasShownApiKeyDialogAtom)
    if (hasShownDialog) return apiKeyDialogOpen

    // if we are in vscode, we don't want to show the dialog
    if (!vscode.isVscode()) {
      return false
    }

    return hasMissingVars
  },
  (get, set, value: boolean) => {
    if (!value) {
      set(hasShownApiKeyDialogAtom, true)
    }
    set(apiKeyDialogOpenAtom, value)
  },
)

// --- ENV VAR ATOMS MOVED FROM shared/baml-project-panel/atoms.ts ---

export const resetEnvKeyValuesAtom = atom(null, (get, set) => {
  set(envKeyValueStorage, []);
});

export const envKeyValuesAtom = atom(
  (get) => {
    const envKeyValues = get(envKeyValueStorage);
    console.log('envKeyValuesAtom getter, returning:', envKeyValues);
    return envKeyValues.map(([k, v], idx): [string, string, number] => [
      k,
      v,
      idx,
    ]);
  },
  (
    get,
    set,
    update: // Update value
      | { itemIndex: number; value: string }
      // Update key
      | { itemIndex: number; newKey: string }
      // Remove key
      | { itemIndex: number; remove: true }
      // Insert key
      | {
          itemIndex: null;
          key: string;
          value?: string;
        },
  ) => {
    console.log('envKeyValuesAtom setter called with update:', update);
    if (update.itemIndex !== null) {
      const keyValues = [...get(envKeyValueStorage)];
      const targetItem = keyValues[update.itemIndex];
      if (targetItem) {
        if ('value' in update) {
          targetItem[1] = update.value ?? '';
        } else if ('newKey' in update) {
          targetItem[0] = update.newKey;
        } else if ('remove' in update) {
          keyValues.splice(update.itemIndex, 1);
        }
      }
      set(envKeyValueStorage, keyValues);
    } else {
      set(envKeyValueStorage, (prev) => [
        ...prev,
        [update.key, update.value ?? ''],
      ]);
    }
  },
);

export const userApiKeysAtom = atom(
  (get) => {
    const envKeyValues = get(envKeyValuesAtom);
    const result = Object.fromEntries(
      envKeyValues
        .map(([k, v]) => [k, v])
        .filter(([k]) => k !== 'BOUNDARY_PROXY_URL'),
    );
    console.log('userApiKeysAtom getter:', { envKeyValues, result });
    return result;
  },
  (get, set, newEnvVars: Record<string, string>) => {
    console.log('userApiKeysAtom setter called with:', newEnvVars);

    // Get current envKeyValues to preserve BOUNDARY_PROXY_URL if it exists
    const currentEnvKeyValues = get(envKeyValuesAtom);
    const boundaryProxyEntry = currentEnvKeyValues
      .find(([k]) => k === 'BOUNDARY_PROXY_URL');

    const envKeyValues = Object.entries(newEnvVars);

    // If BOUNDARY_PROXY_URL existed before, preserve it
    if (boundaryProxyEntry) {
      // Only take the key and value, not the index
      envKeyValues.push([boundaryProxyEntry[0], boundaryProxyEntry[1]]);
    }

    console.log('userApiKeysAtom setter setting envKeyValueStorage to:', envKeyValues);
    set(envKeyValueStorage, envKeyValues);
  },
);

// Computed atom that includes proxy logic (for runtime usage)
export const apiKeysAtom = atom(
  (get) => {
    if (typeof window === 'undefined') {
      return {};
    }

    // Check for Next.js environment
    const isNextJs = !!(window as any).next?.version;

    if (isNextJs) {
      // NextJS environment - check proxy settings but use Next.js specific proxy URL
      const { proxyEnabled } = get(proxyUrlAtom);
      const userEnvVars = get(userApiKeysAtom);

      if (!proxyEnabled) {
        return userEnvVars;
      }

      // Proxy enabled - use Next.js specific proxy URL
      const nextJsProxyUrl = window?.location?.origin?.includes('localhost')
        ? 'https://fiddle-proxy.fly.dev' // localhost development
        : 'https://fiddle-proxy.fly.dev'; // production

      return {
        ...userEnvVars,
        BOUNDARY_PROXY_URL: nextJsProxyUrl,
      };
    }

    const { proxyEnabled, proxyUrl } = get(proxyUrlAtom);
    const userEnvVars = get(userApiKeysAtom);

    if (!proxyEnabled) {
      // if proxy is not enabled, just return user vars without BOUNDARY_PROXY_URL
      return userEnvVars;
    }

    if (proxyUrl === undefined) {
      return userEnvVars;
    }

    // Add or update BOUNDARY_PROXY_URL based on current proxy settings
    return {
      ...userEnvVars,
      BOUNDARY_PROXY_URL: proxyUrl,
    };
  },
  // Delegate writes to userEnvVarsAtom to avoid interference
  (get, set, newEnvVars: Record<string, string>) => {
    const { BOUNDARY_PROXY_URL, ...userVars } = newEnvVars;
    set(userApiKeysAtom, userVars);
  },
);

export const requiredApiKeysAtom = atom((get) => {
  const { rt } = get(runtimeAtom);
  if (rt === undefined) {
    return [];
  }
  const requiredEnvVars = rt.required_env_vars();
  const defaultEnvVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
  for (const e of defaultEnvVars) {
    if (!requiredEnvVars.find((envVar) => e === envVar)) {
      requiredEnvVars.push(e);
    }
  }

  return requiredEnvVars;
});

const defaultEnvKeyValues: [string, string][] = (() => {
  if (typeof window === 'undefined') {
    return [];
  }
  if ((window as any).next?.version) {
    console.log('Running in nextjs');

    const domain = window?.location?.origin || '';
    if (domain.includes('localhost')) {
      // we can do somehting fancier here later if we want to test locally.
      return [['BOUNDARY_PROXY_URL', 'https://fiddle-proxy.fly.dev']];
    }
    return [['BOUNDARY_PROXY_URL', 'https://fiddle-proxy.fly.dev']];
  }
  console.log('Not running in a Next.js environment, set default value');
  // Not running in a Next.js environment, set default value
  return [['BOUNDARY_PROXY_URL', 'http://localhost:0000']];
})();

console.log('Default env key values:', defaultEnvKeyValues);

// Check what's currently in localStorage
if (typeof window !== 'undefined' && window.localStorage) {
  const storedValue = window.localStorage.getItem('env-key-values');
  console.log('Current localStorage value for env-key-values:', storedValue);
  if (storedValue) {
    try {
      const parsed = JSON.parse(storedValue);
      console.log('Parsed localStorage value:', parsed);
    } catch (e) {
      console.error('Failed to parse localStorage value:', e);
    }
  }
}

export const envKeyValueStorage = atomWithStorage<[string, string][]>(
  'env-key-values',
  defaultEnvKeyValues,
  vscodeLocalStorageStore,
  {
    getOnInit: true,
  }
);

// Atom for pending (unsaved) API key rows in the add form
export const pendingApiKeyRowsAtom = atom<Array<{ key: string; value: string }>>([
  { key: '', value: '' },
]);

