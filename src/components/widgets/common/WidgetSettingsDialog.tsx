import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type WidgetSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
  footer?: React.ReactNode;
};

type WidgetSettingsDialogFooterProps = {
  onDelete?: () => void;
  onCancel: () => void;
  onSave: () => void;
  deleteLabel?: string;
  cancelLabel?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  savePending?: boolean;
  savePendingLabel?: string;
};

export function WidgetSettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  contentClassName,
  bodyClassName,
  footer,
}: WidgetSettingsDialogProps) {
  const contentDescriptionProps = description
    ? {}
    : { 'aria-describedby': undefined };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...contentDescriptionProps}
        className={cn('settings-dialog-content sm:max-w-md', contentClassName)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div
          className={cn(
            'settings-dialog-body max-h-[min(60vh,500px)] overflow-y-auto px-1 py-1.5',
            bodyClassName
          )}
        >
          {children}
        </div>

        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

export function WidgetSettingsDialogFooter({
  onDelete,
  onCancel,
  onSave,
  deleteLabel = 'Delete',
  cancelLabel = 'Cancel',
  saveLabel = 'Save',
  saveDisabled = false,
  savePending = false,
  savePendingLabel = 'Saving...',
}: WidgetSettingsDialogFooterProps) {
  return (
    <div className="settings-dialog-actions flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {onDelete ? (
          <Button type="button" variant="destructive" className="min-h-10" onClick={onDelete}>
            {deleteLabel}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="min-h-10" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          className="min-h-10"
          onClick={onSave}
          disabled={saveDisabled || savePending}
        >
          {savePending ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" />
              {savePendingLabel}
            </>
          ) : (
            saveLabel
          )}
        </Button>
      </div>
    </div>
  );
}
