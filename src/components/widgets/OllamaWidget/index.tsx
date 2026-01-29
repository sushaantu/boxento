import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import WidgetHeader from '../common/WidgetHeader';
import { OllamaWidgetConfig, OllamaWidgetProps, ChatMessage, OllamaModel } from './types';
import { Bot, Send, Loader2, AlertCircle, Trash2 } from 'lucide-react';

const OllamaWidget: React.FC<OllamaWidgetProps> = ({ width, height, config }) => {
  const defaultConfig: OllamaWidgetConfig = {
    title: 'Ollama',
    baseUrl: 'https://mini.tailf2415.ts.net:11434/api', // Tailscale Serve endpoint
    model: '',
    systemPrompt: '',
    messages: []
  };

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<OllamaWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update local config when props change
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Fetch available models
  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${localConfig.baseUrl}/tags`);
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      setModels(data.models || []);
      // Set default model if not set
      if (!localConfig.model && data.models?.length > 0) {
        setLocalConfig(prev => ({ ...prev, model: data.models[0].name }));
      }
    } catch (err) {
      setError('Cannot connect to Ollama');
      console.error('Ollama API error:', err);
    } finally {
      setLoading(false);
    }
  }, [localConfig.baseUrl, localConfig.model]);

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localConfig.messages, streamingContent]);

  // Send message to Ollama
  const sendMessage = async () => {
    if (!inputValue.trim() || !localConfig.model || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now()
    };

    const newMessages = [...(localConfig.messages || []), userMessage];
    setLocalConfig(prev => ({ ...prev, messages: newMessages }));
    setInputValue('');
    setIsGenerating(true);
    setStreamingContent('');

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch(`${localConfig.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: localConfig.model,
          messages: [
            ...(localConfig.systemPrompt ? [{ role: 'system', content: localConfig.systemPrompt }] : []),
            ...newMessages.map(m => ({ role: m.role, content: m.content }))
          ],
          stream: true
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('Failed to generate response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                fullContent += json.message.content;
                setStreamingContent(fullContent);
              }
            } catch {
              // Ignore JSON parse errors for partial chunks
            }
          }
        }
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now()
      };

      setLocalConfig(prev => ({
        ...prev,
        messages: [...newMessages, assistantMessage]
      }));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Failed to generate response');
        console.error('Ollama chat error:', err);
      }
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  };

  // Stop generation
  const stopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  // Clear chat
  const clearChat = () => {
    setLocalConfig(prev => ({ ...prev, messages: [] }));
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Determine view mode based on size
  const isCompact = width <= 2 && height <= 2;
  const isMedium = (width >= 3 && width <= 4) || (height >= 3 && height <= 4);

  // Render compact view (status only)
  const renderCompactView = () => {
    const lastMessage = localConfig.messages?.[localConfig.messages.length - 1];

    return (
      <div className="flex flex-col items-center justify-center h-full p-2 text-center">
        {loading ? (
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        ) : error ? (
          <>
            <AlertCircle className="w-8 h-8 text-red-500 mb-1" />
            <span className="text-xs text-red-500">Offline</span>
          </>
        ) : (
          <>
            <Bot className="w-8 h-8 mb-1 text-blue-500" />
            <span className="text-xs font-medium">{localConfig.model?.split(':')[0] || 'No model'}</span>
            {lastMessage && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {lastMessage.content.slice(0, 50)}...
              </p>
            )}
          </>
        )}
      </div>
    );
  };

  // Render chat interface
  const renderChatView = () => {
    const messages = localConfig.messages || [];

    return (
      <div className="flex flex-col h-full">
        {/* Model selector for medium view */}
        {isMedium && (
          <div className="flex items-center gap-2 p-2 border-b">
            <Select
              value={localConfig.model}
              onValueChange={(value) => setLocalConfig(prev => ({ ...prev, model: value }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map(model => (
                  <SelectItem key={model.name} value={model.name}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={clearChat} title="Clear chat">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-grow overflow-y-auto p-2 space-y-2">
          {messages.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Bot className="w-12 h-12 mb-2" />
              <span className="text-sm">Start a conversation</span>
              {localConfig.model && (
                <span className="text-xs mt-1">Using {localConfig.model}</span>
              )}
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </div>
          ))}

          {/* Streaming response */}
          {isGenerating && streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800">
                <p className="whitespace-pre-wrap break-words">{streamingContent}</p>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isGenerating && !streamingContent && (
            <div className="flex justify-start">
              <div className="rounded-lg px-3 py-2 bg-gray-100 dark:bg-gray-800">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-2 border-t">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              className="flex-grow text-sm"
              disabled={isGenerating || !localConfig.model}
            />
            {isGenerating ? (
              <Button variant="destructive" size="sm" onClick={stopGeneration}>
                Stop
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={sendMessage}
                disabled={!inputValue.trim() || !localConfig.model}
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render content based on size
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <span className="text-sm text-red-500">{error}</span>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchModels}>
            Retry
          </Button>
        </div>
      );
    }

    if (isCompact) {
      return renderCompactView();
    }

    return renderChatView();
  };

  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  };

  // Settings dialog
  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ollama Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title-input">Widget Title</Label>
            <Input
              id="title-input"
              type="text"
              value={localConfig.title || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalConfig({ ...localConfig, title: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url-input">Ollama URL</Label>
            <Input
              id="url-input"
              type="url"
              value={localConfig.baseUrl || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalConfig({ ...localConfig, baseUrl: e.target.value })
              }
              placeholder="http://localhost:11434"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model-select">Model</Label>
            <Select
              value={localConfig.model}
              onValueChange={(value) => setLocalConfig({ ...localConfig, model: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.map(model => (
                  <SelectItem key={model.name} value={model.name}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="system-prompt">System Prompt (optional)</Label>
            <textarea
              id="system-prompt"
              className="w-full h-24 px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localConfig.systemPrompt || ''}
              onChange={(e) => setLocalConfig({ ...localConfig, systemPrompt: e.target.value })}
              placeholder="You are a helpful assistant..."
            />
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>
                Delete Widget
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearChat}>
                Clear Chat
              </Button>
              <Button variant="default" onClick={saveSettings}>
                Save
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="widget-container h-full flex flex-col relative">
      <WidgetHeader
        title={localConfig.title || defaultConfig.title}
        onSettingsClick={() => setShowSettings(true)}
      />

      <div className="flex-grow overflow-hidden">
        {renderContent()}
      </div>

      {renderSettings()}
    </div>
  );
};

export default OllamaWidget;
