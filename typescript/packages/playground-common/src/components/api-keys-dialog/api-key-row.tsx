import React, { useCallback } from 'react';
import { Button } from '@baml/ui/button';
import { Input } from '@baml/ui/input';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { ApiKeyStatus } from './api-key-status';
import { escapeValue, unescapeValue } from './utils';
import type { ApiKeyEntry } from './atoms';

interface ApiKeyRowProps {
  apiKey: ApiKeyEntry;
  onUpdate: (key: string, value: string) => void;
  onDelete: (key: string) => void;
  onToggleVisibility: (key: string) => void;
}

// Memoized component for individual environment variable row
// NOTE: This component is currently unused but preserved for potential future use
export const ApiKeyRow = React.memo<ApiKeyRowProps>(({
  apiKey,
  onUpdate,
  onDelete,
  onToggleVisibility,
}) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(apiKey.key, unescapeValue(e.target.value));
  }, [apiKey.key, onUpdate]);

  return (
    <tr className="relative hover:bg-accent/50 rounded-md">
      <td className="pl-2 pr-0.5 py-0.5">
        <div className="flex items-center gap-2 justify-between">
          <code className="font-mono text-xs text-muted-foreground">
            {apiKey.key}
          </code>
          <ApiKeyStatus value={apiKey.value} required={apiKey.required} />
        </div>
      </td>
      <td className="px-0.5 py-0.5">
        <Input
          type={apiKey.hidden ? 'password' : 'text'}
          value={typeof apiKey.value === 'string' ? escapeValue(apiKey.value) : ''}
          onChange={handleChange}
          className="h-6 text-xs font-mono placeholder:font-sans min-w-32"
          placeholder={
            apiKey.required && !apiKey.value ? '<unset>' : undefined
          }
          autoComplete="off"
          data-1p-ignore
        />
      </td>
      <td className="pl-0.5 pr-2 py-0.5 text-right">
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="p-0.5 w-5 h-5"
            onClick={() => onToggleVisibility(apiKey.key)}
          >
            {apiKey.hidden ? (
              <EyeOff className="w-4 h-4 text-muted-foreground hover:text-primary" />
            ) : (
              <Eye className="w-4 h-4 text-muted-foreground hover:text-primary" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="p-0.5 w-5 h-5"
            onClick={() => onDelete(apiKey.key)}
          >
            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
});