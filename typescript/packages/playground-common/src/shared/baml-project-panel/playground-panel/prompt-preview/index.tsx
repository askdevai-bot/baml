'use client';
import { PreviewToolbar } from '../preview-toolbar';
import { ApiKeysDialog } from '../../../../components/api-keys-dialog/dialog';
import { PromptRenderWrapper } from './prompt-render-wrapper';
import TestPanel from './test-panel';

export const PromptPreview = () => {
  return (
    <div className="p-2">
        <div className="flex w-full h-full bg-background text-foreground">
          <div className="flex overflow-y-auto flex-col w-full h-full gap-2">
            <ApiKeysDialog />
            <PreviewToolbar />
            <PromptRenderWrapper />
            <TestPanel />
          </div>
        </div>
    </div>
  );
};
