// Type declarations for @boxento/primitives
// This provides basic type support until the primitives library has proper DTS generation

declare module '@boxento/primitives' {
  import * as React from 'react';

  // Utility
  export function cn(...inputs: (string | undefined | null | false | Record<string, boolean>)[]): string;

  // Button
  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    asChild?: boolean;
  }
  export const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
  export function buttonVariants(props?: Partial<ButtonProps>): string;

  // Dialog
  export const Dialog: React.FC<{ open?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode }>;
  export const DialogTrigger: React.FC<React.HTMLAttributes<HTMLButtonElement>>;
  export const DialogPortal: React.FC<{ children?: React.ReactNode }>;
  export const DialogBackdrop: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const DialogClose: React.FC<React.HTMLAttributes<HTMLButtonElement>>;
  export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
  export const DialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>>;

  // Input
  export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
  export const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;

  // Select
  export const Select: React.FC<{ value?: string; onValueChange?: (value: string) => void; children?: React.ReactNode; defaultValue?: string }>;
  export const SelectTrigger: React.FC<React.HTMLAttributes<HTMLButtonElement> & { id?: string }>;
  export const SelectValue: React.FC<{ placeholder?: string }>;
  export const SelectContent: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const SelectItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { value: string }>;
  export const SelectLabel: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const SelectSeparator: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const SelectGroup: React.FC<React.HTMLAttributes<HTMLDivElement>>;

  // Switch
  export interface SwitchProps extends React.HTMLAttributes<HTMLButtonElement> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
  }
  export const Switch: React.ForwardRefExoticComponent<SwitchProps & React.RefAttributes<HTMLButtonElement>>;

  // Checkbox
  export interface CheckboxProps extends React.HTMLAttributes<HTMLButtonElement> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
  }
  export const Checkbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLButtonElement>>;

  // Tabs
  export const Tabs: React.FC<{ value?: string; onValueChange?: (value: string) => void; defaultValue?: string; children?: React.ReactNode }>;
  export const TabsList: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const TabsTrigger: React.FC<React.HTMLAttributes<HTMLButtonElement> & { value: string }>;
  export const TabsContent: React.FC<React.HTMLAttributes<HTMLDivElement> & { value: string }>;

  // Popover
  export const Popover: React.FC<{ open?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode }>;
  export const PopoverTrigger: React.FC<React.HTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>;
  export const PopoverContent: React.FC<React.HTMLAttributes<HTMLDivElement> & { sideOffset?: number; align?: 'start' | 'center' | 'end' }>;
  export const PopoverAnchor: React.FC<React.HTMLAttributes<HTMLDivElement>>;

  // Label
  export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}
  export const Label: React.ForwardRefExoticComponent<LabelProps & React.RefAttributes<HTMLLabelElement>>;

  // Separator
  export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
    orientation?: 'horizontal' | 'vertical';
    decorative?: boolean;
  }
  export const Separator: React.ForwardRefExoticComponent<SeparatorProps & React.RefAttributes<HTMLDivElement>>;

  // Tooltip
  export const Tooltip: React.FC<{ children?: React.ReactNode }>;
  export const TooltipTrigger: React.FC<React.HTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>;
  export const TooltipContent: React.FC<React.HTMLAttributes<HTMLDivElement> & { sideOffset?: number }>;
  export const TooltipProvider: React.FC<{ children?: React.ReactNode; delayDuration?: number }>;

  // Slider
  export interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    value?: number[];
    onValueChange?: (value: number[]) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
  }
  export const Slider: React.ForwardRefExoticComponent<SliderProps & React.RefAttributes<HTMLDivElement>>;

  // Scroll Area
  export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}
  export const ScrollArea: React.ForwardRefExoticComponent<ScrollAreaProps & React.RefAttributes<HTMLDivElement>>;
  export interface ScrollBarProps extends React.HTMLAttributes<HTMLDivElement> {
    orientation?: 'horizontal' | 'vertical';
  }
  export const ScrollBar: React.ForwardRefExoticComponent<ScrollBarProps & React.RefAttributes<HTMLDivElement>>;

  // Radio Group
  export const RadioGroup: React.FC<{ value?: string; onValueChange?: (value: string) => void; children?: React.ReactNode; defaultValue?: string }>;
  export interface RadioGroupItemProps extends React.HTMLAttributes<HTMLButtonElement> {
    value: string;
    disabled?: boolean;
  }
  export const RadioGroupItem: React.ForwardRefExoticComponent<RadioGroupItemProps & React.RefAttributes<HTMLButtonElement>>;

  // Progress
  export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: number;
    max?: number;
  }
  export const Progress: React.ForwardRefExoticComponent<ProgressProps & React.RefAttributes<HTMLDivElement>>;

  // Skeleton
  export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}
  export const Skeleton: React.FC<SkeletonProps>;

  // Card
  export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
  export const Card: React.ForwardRefExoticComponent<CardProps & React.RefAttributes<HTMLDivElement>>;
  export const CardHeader: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  export const CardTitle: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLHeadingElement> & React.RefAttributes<HTMLHeadingElement>>;
  export const CardDescription: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLParagraphElement> & React.RefAttributes<HTMLParagraphElement>>;
  export const CardContent: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  export const CardFooter: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;

  // Avatar
  export const Avatar: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const AvatarImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>>;
  export const AvatarFallback: React.FC<React.HTMLAttributes<HTMLSpanElement>>;

  // Calendar
  export const Calendar: React.FC<{
    mode?: 'single' | 'multiple' | 'range';
    selected?: Date | Date[] | { from?: Date; to?: Date };
    onSelect?: (date: Date | undefined) => void;
    disabled?: (date: Date) => boolean;
    className?: string;
    classNames?: Record<string, string>;
    showOutsideDays?: boolean;
    [key: string]: unknown;
  }>;
  export const CalendarDayButton: React.FC<React.HTMLAttributes<HTMLButtonElement>>;

  // Dropdown Menu
  export const DropdownMenu: React.FC<{ open?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode }>;
  export const DropdownMenuPortal: React.FC<{ children?: React.ReactNode }>;
  export const DropdownMenuTrigger: React.FC<React.HTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>;
  export const DropdownMenuContent: React.FC<React.HTMLAttributes<HTMLDivElement> & { sideOffset?: number }>;
  export const DropdownMenuGroup: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const DropdownMenuLabel: React.FC<React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>;
  export const DropdownMenuItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { inset?: boolean; variant?: 'default' | 'destructive' }>;
  export const DropdownMenuCheckboxItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }>;
  export const DropdownMenuRadioGroup: React.FC<{ value?: string; onValueChange?: (value: string) => void; children?: React.ReactNode }>;
  export const DropdownMenuRadioItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { value: string }>;
  export const DropdownMenuSeparator: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const DropdownMenuShortcut: React.FC<React.HTMLAttributes<HTMLSpanElement>>;
  export const DropdownMenuSub: React.FC<{ children?: React.ReactNode }>;
  export const DropdownMenuSubTrigger: React.FC<React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>;
  export const DropdownMenuSubContent: React.FC<React.HTMLAttributes<HTMLDivElement>>;

  // Context Menu
  export const ContextMenu: React.FC<{ children?: React.ReactNode }>;
  export const ContextMenuTrigger: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const ContextMenuContent: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const ContextMenuItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { inset?: boolean; variant?: 'default' | 'destructive' }>;
  export const ContextMenuCheckboxItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }>;
  export const ContextMenuRadioItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { value: string }>;
  export const ContextMenuLabel: React.FC<React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>;
  export const ContextMenuSeparator: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const ContextMenuShortcut: React.FC<React.HTMLAttributes<HTMLSpanElement>>;
  export const ContextMenuGroup: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const ContextMenuPortal: React.FC<{ children?: React.ReactNode }>;
  export const ContextMenuSub: React.FC<{ children?: React.ReactNode }>;
  export const ContextMenuSubContent: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const ContextMenuSubTrigger: React.FC<React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>;
  export const ContextMenuRadioGroup: React.FC<{ value?: string; onValueChange?: (value: string) => void; children?: React.ReactNode }>;
}
