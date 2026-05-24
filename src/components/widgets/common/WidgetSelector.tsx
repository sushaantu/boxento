import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  BookMarked,
  BookOpen,
  Calendar,
  CheckSquare,
  Clock,
  Cloud,
  DollarSign,
  DoorOpen,
  Film,
  GitBranch,
  Globe,
  Home,
  Lightbulb,
  Link,
  PiggyBank,
  Plane,
  Plus,
  QrCode,
  Rss,
  Search,
  Server,
  StickyNote,
  Thermometer,
  Timer,
  Video,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WidgetConfig } from '@/types';
import { cn } from '@/lib/utils';

interface WidgetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (type: string) => void;
  widgetRegistry: WidgetConfig[];
  widgetCategories: { [category: string]: WidgetConfig[] };
}

type CategoryOption = {
  id: string;
  name: string;
  count: number;
};

const ICONS: Record<string, LucideIcon> = {
  Activity,
  BookMarked,
  BookOpen,
  Bot,
  Calendar,
  CheckSquare,
  Clock,
  Cloud,
  DollarSign,
  DoorOpen,
  Film,
  Github: GitBranch,
  Globe,
  Home,
  Lightbulb,
  Link,
  PiggyBank,
  Plane,
  QrCode,
  Rss,
  Server,
  StickyNote,
  Thermometer,
  Timer,
  Video,
};

const createCategoryId = (category: string) => (
  category.toLowerCase().replace(/[^a-z0-9]+/g, '-')
);

const getWidgetSearchText = (widget: WidgetConfig) => (
  `${widget.name} ${widget.description ?? ''} ${widget.category ?? ''}`.toLowerCase()
);

/**
 * Widget Selector Component
 *
 * Provides a modal interface for searching and adding widgets to the dashboard.
 */
const WidgetSelector = ({
  isOpen,
  onClose,
  onAddWidget,
  widgetRegistry,
  widgetCategories,
}: WidgetSelectorProps): React.ReactElement | null => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');

  const categories = useMemo<CategoryOption[]>(() => {
    const categoryOptions = Object.entries(widgetCategories).map(([category, widgets]) => ({
      id: createCategoryId(category),
      name: category,
      count: widgets.length,
    }));

    categoryOptions.sort((a, b) => a.name.localeCompare(b.name));

    return [
      { id: 'all', name: 'All Widgets', count: widgetRegistry.length },
      ...categoryOptions,
    ];
  }, [widgetCategories, widgetRegistry.length]);

  const widgetsByCategoryId = useMemo(() => {
    const entries = Object.entries(widgetCategories).map(([category, widgets]) => [
      createCategoryId(category),
      widgets,
    ] as const);

    return new Map<string, WidgetConfig[]>([
      ['all', widgetRegistry],
      ...entries,
    ]);
  }, [widgetCategories, widgetRegistry]);

  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? categories[0];
  const scopedWidgets = widgetsByCategoryId.get(selectedCategoryId) ?? widgetRegistry;
  const visibleWidgets = useMemo(() => {
    if (!trimmedSearchQuery) {
      return scopedWidgets;
    }

    return widgetRegistry.filter((widget) => getWidgetSearchText(widget).includes(trimmedSearchQuery));
  }, [scopedWidgets, trimmedSearchQuery, widgetRegistry]);
  const resultLabel = trimmedSearchQuery
    ? `${visibleWidgets.length} result${visibleWidgets.length === 1 ? '' : 's'}`
    : `${selectedCategory.count} widget${selectedCategory.count === 1 ? '' : 's'}`;

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedCategoryId('all');
    }
  }, [isOpen]);

  const renderWidgetIcon = (icon?: string): React.ReactElement => {
    const Icon = icon ? ICONS[icon] : undefined;
    return Icon ? <Icon /> : <Plus />;
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const handleAddWidget = (widgetType: string) => {
    onAddWidget(widgetType);
  };

  const renderWidgetCard = (widget: WidgetConfig): React.ReactElement => (
    <Button
      key={widget.type}
      type="button"
      variant="outline"
      size="none"
      className="group h-full min-h-[96px] w-full justify-start rounded-2xl border-border/70 bg-card p-3 text-left shadow-none hover:border-foreground/20 hover:bg-muted/40 sm:p-4"
      onClick={() => handleAddWidget(widget.type)}
      aria-label={`Add ${widget.name} widget`}
    >
      <span className="flex h-full min-w-0 flex-1 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground group-hover:text-foreground">
          {renderWidgetIcon(widget.icon)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {widget.name}
          </span>
          {widget.description ? (
            <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
              {widget.description}
            </span>
          ) : null}
        </span>
      </span>
    </Button>
  );

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="grid max-h-[min(760px,calc(100vh-1rem))] gap-0 overflow-hidden p-0 sm:max-w-[980px]"
      >
        <DialogHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
          <div className="flex flex-col gap-3 pr-10 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle className="text-xl">Add Widget</DialogTitle>
              <DialogDescription>
                Choose a widget, search by name, or browse by category.
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="secondary">{widgetRegistry.length} widgets</Badge>
              <Badge variant="outline">{categories.length - 1} categories</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
          <InputGroup className="h-10">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="text"
              placeholder="Search widgets..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search widgets"
              autoFocus
            />
            {searchQuery ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="xs"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear widget search"
                >
                  Clear
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>

          <div className="min-h-0 overflow-hidden rounded-2xl border border-border/70 bg-background">
            <div className="grid min-h-0 grid-rows-[auto_1fr] md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-1">
              <div className="border-b border-border/70 bg-muted/30 p-3 md:border-b-0 md:border-r">
                <ScrollArea className="max-h-[132px] md:h-[520px] md:max-h-none">
                  <div className="flex gap-2 md:flex-col">
                    {categories.map((category) => {
                      const active = !trimmedSearchQuery && category.id === selectedCategoryId;

                      return (
                        <button
                          key={category.id}
                          type="button"
                          className={cn(
                            'flex h-9 min-w-fit items-center justify-between gap-3 rounded-xl px-3 text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 md:w-full',
                            active && 'font-medium text-foreground'
                          )}
                          onClick={() => {
                            setSelectedCategoryId(category.id);
                            setSearchQuery('');
                          }}
                          aria-pressed={active}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                'h-4 w-0.5 rounded-full bg-transparent',
                                active && 'bg-muted-foreground'
                              )}
                              aria-hidden="true"
                            />
                            <span className="truncate">{category.name}</span>
                          </span>
                          <Badge variant="outline" className="ml-2">
                            {category.count}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex min-h-0 flex-col">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {trimmedSearchQuery ? 'Search Results' : selectedCategory.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{resultLabel}</div>
                  </div>
                </div>

                <ScrollArea className="h-[min(50vh,460px)] min-h-0">
                  <div className="p-4 pt-0">
                    {visibleWidgets.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {visibleWidgets.map(renderWidgetCard)}
                      </div>
                    ) : (
                      <Empty className="min-h-[280px] border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Search />
                          </EmptyMedia>
                          <EmptyTitle>No widgets found</EmptyTitle>
                          <EmptyDescription>
                            No widgets match "{searchQuery}". Try a widget name, category, or
                            the job you want the widget to do.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WidgetSelector;
