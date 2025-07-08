import { Tabs, TabsList, TabsTrigger, TabsContent } from '@baml/ui/tabs';
import { PromptPreviewCurl } from './prompt-preview-curl';
import { PromptPreviewContent } from './prompt-preview-content';
import { ClientGraphView } from './test-panel/components/ClientGraphView';

export const PromptRenderWrapper = () => {

  return (
    <Tabs defaultValue="preview">
      <TabsList>
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="curl">cURL</TabsTrigger>
        <TabsTrigger value="client-graph">Client Graph</TabsTrigger>
      </TabsList>
      <TabsContent value="preview">
        <PromptPreviewContent />
      </TabsContent>
      <TabsContent value="curl">
        <PromptPreviewCurl />
      </TabsContent>
      <TabsContent value="client-graph">
        <ClientGraphView />
      </TabsContent>
    </Tabs>
  );
};
