import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { Textarea } from '../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup
} from '../../ui/select';
import WidgetHeader from '../common/WidgetHeader';
import { OllamaWidgetConfig, OllamaWidgetProps, ChatMessage, OllamaModel } from './types';
import { cn } from '@/lib/utils';
import { Bot, Send, Loader2, AlertCircle, Trash2, Settings2, MessageSquare, Cpu } from 'lucide-react';

const defaultConfig: OllamaWidgetConfig = {
  title: 'Ollama',
  baseUrl: 'http://localhost:11434/api',
  model: '',
  systemPrompt: '',
  messages: [],
};

const OllamaWidget: React.FC<OllamaWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<OllamaWidgetConfig>({
    ...defaultConfig,
    ...config,
  });
  const [configSnapshot, setConfigSnapshot] = useState<OllamaWidgetConfig>({
    ...defaultConfig,
    ...config,
  });
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync with external config changes
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
      if (!localConfig.model && data.models?.length > 0) {
        const newConfig = { ...localConfig, model: data.models[0].name };
        setLocalConfig(newConfig);
        if (config?.onUpdate) {
          config.onUpdate(newConfig);
        }
      }
    } catch {
      setError('Cannot connect to Ollama');
    } finally {
      setLoading(false);
    }
  }, [localConfig.baseUrl, localConfig.model, config]);

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localConfig.messages, streamingContent]);

  // Connection status derived from state
  const connectionStatus = useMemo(() => {
    if (loading) return 'checking' as const;
    if (error) return 'offline' as const;
    return 'online' as const;
  }, [loading, error]);

  const statusDotColor = useMemo(() => {
    switch (connectionStatus) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'checking': return 'bg-yellow-500 animate-pulse';
    }
  }, [connectionStatus]);

  // Send message to Ollama
  const sendMessage = async () => {
    if (!inputValue.trim() || !localConfig.model || isGenerating || readOnly) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...(localConfig.messages || []), userMessage];
    const updatedConfig = { ...localConfig, messages: newMessages };
    setLocalConfig(updatedConfig);
    if (config?.onUpdate) config.onUpdate(updatedConfig);
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
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
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
        timestamp: Date.now(),
      };

      const finalConfig = { ...localConfig, messages: [...newMessages, assistantMessage] };
      setLocalConfig(finalConfig);
      if (config?.onUpdate) config.onUpdate(finalConfig);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Failed to generate response');
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
    if (readOnly) return;
    const updated = { ...localConfig, messages: [] };
    setLocalConfig(updated);
    if (config?.onUpdate) config.onUpdate(updated);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const messages = localConfig.messages || [];
  const lastMessage = messages[messages.length - 1];
  const modelShortName = localConfig.model?.split(':')[0] || 'No model';

  // --- Snapshot / revert for settings modal ---
  const handleSettingsOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setConfigSnapshot({ ...localConfig });
    } else {
      // Revert unsaved changes
      setLocalConfig(configSnapshot);
    }
    setShowSettings(nextOpen);
  }, [localConfig, configSnapshot]);

  const handleCancelSettings = useCallback(() => {
    setLocalConfig(configSnapshot);
    setShowSettings(false);
  }, [configSnapshot]);

  const saveSettings = useCallback(() => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setConfigSnapshot(localConfig);
    setShowSettings(false);
  }, [config, localConfig]);

  // ========== SIZE-SPECIFIC RENDERERS ==========

  // 1x1 ICON: bot icon with connection status dot
  const renderTiny = () => (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <div className="relative">
        <Bot className="h-6 w-6 text-blue-500" />
        <div className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${statusDotColor}`} />
      </div>
      <div className="text-[10px] font-medium leading-tight text-muted-foreground truncate w-full">
        {modelShortName}
      </div>
    </div>
  );

  // Nx1 RIBBON: model name + status chips
  const renderShort = () => (
    <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
      <div className="flex shrink-0 items-center gap-1.5">
        <Bot className="h-3.5 w-3.5 text-blue-500" />
        <span className="font-medium text-foreground">{modelShortName}</span>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        connectionStatus === 'online'
          ? 'bg-green-500/10 text-green-700 dark:text-green-300'
          : connectionStatus === 'offline'
            ? 'bg-red-500/10 text-red-700 dark:text-red-300'
            : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
      }`}>
        {connectionStatus}
      </span>
      {messages.length > 0 && (
        <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-700 dark:text-blue-300">
          {messages.length} msgs
        </span>
      )}
      {lastMessage && (
        <span className="truncate text-[11px] text-muted-foreground">
          {lastMessage.role === 'user' ? 'You: ' : 'AI: '}{lastMessage.content.slice(0, 60)}
        </span>
      )}
    </div>
  );

  // 2x2 MICRO: recent message preview + minimal input
  const renderCompact = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center p-1 text-center">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : error ? (
          <>
            <AlertCircle className="h-6 w-6 text-red-500 mb-1" />
            <span className="text-[10px] text-red-500">Offline</span>
          </>
        ) : (
          <>
            <Bot className="h-6 w-6 mb-1 text-blue-500" />
            <span className="text-[10px] font-medium text-foreground">{modelShortName}</span>
            {lastMessage && (
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-3 leading-tight px-1">
                {lastMessage.role === 'assistant' ? '' : 'You: '}{lastMessage.content.slice(0, 80)}
              </p>
            )}
            {!lastMessage && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {connectionStatus === 'online' ? 'Ready to chat' : 'Connecting...'}
              </p>
            )}
          </>
        )}
      </div>
      {!readOnly && !error && (
        <div className="p-1 border-t">
          <div className="flex gap-1">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask..."
              className="h-6 text-[10px] flex-grow"
              disabled={isGenerating || !localConfig.model}
            />
            <Button
              variant="default"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={sendMessage}
              disabled={!inputValue.trim() || !localConfig.model || isGenerating}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // Message bubble component (shared between default, panel, and app)
  const renderMessageBubble = (message: ChatMessage, compact: boolean = false) => (
    <div
      key={message.id}
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${compact ? 'text-xs' : 'text-sm'} ${
          message.role === 'user'
            ? 'bg-blue-500 text-white'
            : 'bg-muted'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );

  // Streaming indicator
  const renderStreamingIndicator = (compact: boolean = false) => (
    <>
      {isGenerating && streamingContent && (
        <div className="flex justify-start">
          <div className={`max-w-[80%] rounded-lg px-3 py-2 ${compact ? 'text-xs' : 'text-sm'} bg-muted`}>
            <p className="whitespace-pre-wrap break-words">{streamingContent}</p>
          </div>
        </div>
      )}
      {isGenerating && !streamingContent && (
        <div className="flex justify-start">
          <div className="rounded-lg px-3 py-2 bg-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>
      )}
    </>
  );

  // Empty state for chat
  const renderEmptyChat = (iconSize: string = 'h-10 w-10') => (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <Bot className={`${iconSize} mb-2`} />
      <span className="text-sm">Start a conversation</span>
      {localConfig.model && (
        <span className="text-xs mt-1">Using {localConfig.model}</span>
      )}
    </div>
  );

  // Chat input bar
  const renderInputBar = (compact: boolean = false) => {
    if (readOnly) return null;
    return (
      <div className={`border-t ${compact ? 'p-1.5' : 'p-2'}`}>
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className={`flex-grow ${compact ? 'text-xs h-7' : 'text-sm'}`}
            disabled={isGenerating || !localConfig.model}
          />
          {isGenerating ? (
            <Button variant="destructive" size="sm" onClick={stopGeneration} className={compact ? 'h-7 text-xs' : ''}>
              Stop
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={sendMessage}
              disabled={!inputValue.trim() || !localConfig.model}
              className={compact ? 'h-7' : ''}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  // 3x3 DEFAULT WIDGET: chat with shorter history, basic input
  const renderDefault = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <span className="text-sm text-red-500">{error}</span>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchModels}>
            Retry
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {messages.length === 0 && !isGenerating && renderEmptyChat('h-10 w-10')}
          {messages.map((message) => renderMessageBubble(message, true))}
          {renderStreamingIndicator(true)}
          <div ref={messagesEndRef} />
        </div>
        {renderInputBar(true)}
      </div>
    );
  };

  // 4x4-5x5 PANEL: chat with model selector, clear button, spacious messages
  const renderPanel = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <span className="text-sm text-red-500">{error}</span>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchModels}>
            Retry
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Toolbar: model selector + actions */}
        <div className="flex items-center gap-2 px-3 py-2">
          <Select
            value={localConfig.model}
            onValueChange={(value) => {
              const updated = { ...localConfig, model: value };
              setLocalConfig(updated);
              if (config?.onUpdate) config.onUpdate(updated);
            }}
          >
            <SelectTrigger className="h-8 text-xs w-[180px]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
              {models.map(model => (
                <SelectItem key={model.name} value={model.name}>
                  {model.name}
                </SelectItem>
              ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className={`h-2 w-2 rounded-full ${statusDotColor}`} />
          <span className="text-xs text-muted-foreground">{connectionStatus}</span>
          <div className="flex-1" />
          {!readOnly && messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} title="Clear chat" className="h-7 text-xs">
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && !isGenerating && renderEmptyChat('h-12 w-12')}
          {messages.map((message) => renderMessageBubble(message))}
          {renderStreamingIndicator()}
          <div ref={messagesEndRef} />
        </div>

        {renderInputBar()}
      </div>
    );
  };

  // 6x6+ APP: full chat with sidebar (conversation info, model selector, system prompt, stats)
  const renderApp = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <span className="text-sm text-red-500">{error}</span>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchModels}>
            Retry
          </Button>
        </div>
      );
    }

    const userMsgCount = messages.filter(m => m.role === 'user').length;
    const assistantMsgCount = messages.filter(m => m.role === 'assistant').length;

    return (
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-1/4 min-w-[200px] max-w-[280px] border-r flex flex-col overflow-y-auto">
          {/* Model selector */}
          <div className="p-3 space-y-3 widget-drag-handle cursor-move">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Model</span>
            </div>
            <Select
              value={localConfig.model}
              onValueChange={(value) => {
                const updated = { ...localConfig, model: value };
                setLocalConfig(updated);
                if (config?.onUpdate) config.onUpdate(updated);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                {models.map(model => (
                  <SelectItem key={model.name} value={model.name}>
                    {model.name}
                  </SelectItem>
                ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Connection status */}
          <div className="px-3 py-2 border-b">
            <div className="flex items-center gap-2 text-xs">
              <div className={`h-2 w-2 rounded-full ${statusDotColor}`} />
              <span className="text-muted-foreground capitalize">{connectionStatus}</span>
            </div>
          </div>

          {/* System prompt editor (inline in app mode) */}
          {!readOnly && (
            <div className="p-3 border-b space-y-2">
              <Label htmlFor="ollama-system-prompt-inline" className="text-xs">System Prompt</Label>
              <Textarea
                id="ollama-system-prompt-inline"
                className="h-20 resize-none px-2 py-1.5 text-xs"
                value={localConfig.systemPrompt || ''}
                onChange={(e) => {
                  const updated = { ...localConfig, systemPrompt: e.target.value };
                  setLocalConfig(updated);
                  if (config?.onUpdate) config.onUpdate(updated);
                }}
                placeholder="You are a helpful assistant..."
              />
            </div>
          )}
          {readOnly && localConfig.systemPrompt && (
            <div className="p-3 border-b space-y-1">
              <span className="text-xs font-medium text-foreground">System Prompt</span>
              <p className="text-xs text-muted-foreground line-clamp-4">{localConfig.systemPrompt}</p>
            </div>
          )}

          {/* Stats */}
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Conversation</span>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Total messages</span>
                <span className="font-medium text-foreground">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Your messages</span>
                <span className="font-medium text-foreground">{userMsgCount}</span>
              </div>
              <div className="flex justify-between">
                <span>AI responses</span>
                <span className="font-medium text-foreground">{assistantMsgCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Models available</span>
                <span className="font-medium text-foreground">{models.length}</span>
              </div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Actions at bottom of sidebar */}
          {!readOnly && messages.length > 0 && (
            <div className="p-3 border-t">
              <Button variant="outline" size="sm" onClick={clearChat} className="w-full text-xs">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Clear conversation
              </Button>
            </div>
          )}
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !isGenerating && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Bot className="h-16 w-16 mb-3" />
                <span className="text-base font-medium">Start a conversation</span>
                {localConfig.model && (
                  <span className="text-sm mt-1">Using {localConfig.model}</span>
                )}
                {localConfig.systemPrompt && (
                  <span className="text-xs mt-2 text-muted-foreground/70 max-w-sm text-center">
                    System prompt configured
                  </span>
                )}
              </div>
            )}
            {messages.map((message) => renderMessageBubble(message))}
            {renderStreamingIndicator()}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {!readOnly && (
            <div className="border-t p-3">
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
                    <Send className="h-4 w-4 mr-1.5" />
                    Send
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ========== SETUP PROMPT ==========
  const needsSetup = !localConfig.baseUrl;

  if (needsSetup && !isTiny) {
    return (
      <div className="widget-container h-full flex flex-col p-2 md:p-3">
        <WidgetHeader
          title={localConfig.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Settings2 className="h-8 w-8" />
          <p className="text-sm">Configure Ollama to get started</p>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              Open Settings
            </Button>
          )}
        </div>
        {renderSettingsDialog()}
      </div>
    );
  }

  // ========== SETTINGS MODAL ==========
  function renderSettingsDialog() {
    return (
      <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
        <DialogContent className="settings-dialog-content sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{localConfig.title || 'Ollama'} Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title-input">Widget Title</Label>
              <Input
                id="title-input"
                type="text"
                value={localConfig.title || ''}
                onChange={(e) =>
                  setLocalConfig(prev => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="url-input">Ollama URL</Label>
              <Input
                id="url-input"
                type="url"
                value={localConfig.baseUrl || ''}
                onChange={(e) =>
                  setLocalConfig(prev => ({ ...prev, baseUrl: e.target.value }))
                }
                placeholder="http://localhost:11434/api"
              />
              <p className="text-xs text-muted-foreground mt-1">Include /api suffix (e.g., http://localhost:11434/api)</p>
            </div>

            <div>
              <Label htmlFor="model-select">Model</Label>
              <Select
                value={localConfig.model}
                onValueChange={(value) =>
                  setLocalConfig(prev => ({ ...prev, model: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                  {models.map(model => (
                    <SelectItem key={model.name} value={model.name}>
                      {model.name}
                    </SelectItem>
                  ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="system-prompt">System Prompt (optional)</Label>
              <Textarea
                id="system-prompt"
                className="h-24 resize-none"
                value={localConfig.systemPrompt || ''}
                onChange={(e) =>
                  setLocalConfig(prev => ({ ...prev, systemPrompt: e.target.value }))
                }
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
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" onClick={handleCancelSettings}>
                  Cancel
                </Button>
                <Button onClick={saveSettings}>
                  Save
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ========== MAIN RENDER ==========
  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title || defaultConfig.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      <div className={`flex-grow overflow-hidden ${isTiny ? 'p-1.5' : ''}`}>
        {isTiny ? renderTiny()
          : isShort ? renderShort()
          : isApp ? renderApp()
          : isWide && isTall ? renderPanel()
          : isCompact ? renderCompact()
          : renderDefault()}
      </div>

      {renderSettingsDialog()}
    </div>
  );
};

export default OllamaWidget;
