import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup
} from '@/components/ui/select';
import {
  WidgetSettingsDialog,
  WidgetSettingsDialogFooter,
} from '../common/WidgetSettingsDialog';
import type { HomeAssistantArea, HomeAssistantBaseConfig } from './types';
import { formatEntityIds, parseEntityIds } from './utils';

type HomeAssistantSettingsDialogProps<TConfig extends HomeAssistantBaseConfig> = {
  open: boolean;
  title: string;
  config: TConfig;
  areas?: HomeAssistantArea[];
  showArea?: boolean;
  showEntityIds?: boolean;
  entityHelp?: string;
  onConfigChange: (config: TConfig) => void;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  children?: React.ReactNode;
};

export function HomeAssistantSettingsDialog<TConfig extends HomeAssistantBaseConfig>({
  open,
  title,
  config,
  areas = [],
  showArea = false,
  showEntityIds = false,
  entityHelp = 'Optional entity ids, one per line or comma separated.',
  onConfigChange,
  onOpenChange,
  onCancel,
  onSave,
  onDelete,
  children,
}: HomeAssistantSettingsDialogProps<TConfig>) {
  const updateConfig = (patch: Partial<TConfig>) => {
    onConfigChange({ ...config, ...patch });
  };

  return (
    <WidgetSettingsDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
          return;
        }
        onOpenChange(nextOpen);
      }}
      title={title}
      description="Connect this widget to your Home Assistant HTTP API."
      bodyClassName="flex flex-col gap-4 px-1"
      footer={(
        <WidgetSettingsDialogFooter
          onDelete={onDelete}
          onCancel={onCancel}
          onSave={onSave}
        />
      )}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="ha-title">Widget Title</Label>
        <Input
          id="ha-title"
          value={config.title || ''}
          onChange={(event) => updateConfig({ title: event.target.value } as Partial<TConfig>)}
          placeholder={title.replace(' Settings', '')}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ha-url">Home Assistant URL</Label>
          <Input
            id="ha-url"
            value={config.baseUrl || ''}
            onChange={(event) => updateConfig({ baseUrl: event.target.value } as Partial<TConfig>)}
            placeholder="http://homeassistant.local:8123"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ha-refresh">Refresh Seconds</Label>
          <Input
            id="ha-refresh"
            type="number"
            min={10}
            value={String(config.refreshInterval || 30)}
            onChange={(event) => updateConfig({ refreshInterval: Number(event.target.value) || 30 } as Partial<TConfig>)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ha-token">Long-Lived Access Token</Label>
        <Input
          id="ha-token"
          type="password"
          value={config.apiToken || ''}
          onChange={(event) => updateConfig({ apiToken: event.target.value } as Partial<TConfig>)}
          placeholder="Paste a Home Assistant token"
        />
        <p className="text-xs text-muted-foreground">
          Create this in Home Assistant profile settings. Your browser may need HA CORS configured.
        </p>
      </div>

      {showArea ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="ha-area">Room / Area</Label>
          {areas.length ? (
            <Select
              value={config.areaId || 'all'}
              onValueChange={(value) => updateConfig({ areaId: value === 'all' ? '' : value } as Partial<TConfig>)}
            >
              <SelectTrigger id="ha-area" className="w-full">
                <SelectValue placeholder="All rooms" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                <SelectItem value="all">All rooms</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.area_id} value={area.area_id}>{area.name}</SelectItem>
                ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="ha-area"
              value={config.areaId || ''}
              onChange={(event) => updateConfig({ areaId: event.target.value } as Partial<TConfig>)}
              placeholder="Optional area id"
            />
          )}
        </div>
      ) : null}

      {showEntityIds ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="ha-entities">Entity IDs</Label>
          <textarea
            id="ha-entities"
            value={formatEntityIds(config.entityIds)}
            onChange={(event) => updateConfig({ entityIds: parseEntityIds(event.target.value) } as Partial<TConfig>)}
            placeholder="light.kitchen&#10;climate.living_room"
            className="min-h-24 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">{entityHelp}</p>
        </div>
      ) : null}

      {children}

      <Button
        type="button"
        variant="outline"
        onClick={() => updateConfig({
          baseUrl: config.baseUrl || 'http://homeassistant.local:8123',
          refreshInterval: config.refreshInterval || 30,
        } as Partial<TConfig>)}
      >
        Use Local Defaults
      </Button>
    </WidgetSettingsDialog>
  );
}
