import React, { useState } from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuGroup,
  ContextMenuLabel
} from '@/components/ui/context-menu';
import { AppSettingsModal } from '@/components/settings/AppSettingsModal';
import {
  Plus,
  Settings2,
  LayoutGrid
} from 'lucide-react';

interface DashboardContextMenuProps {
  children: React.ReactNode;
  onAddWidget: () => void;
  onAutoArrange?: () => void;
}

export function DashboardContextMenu({ children, onAddWidget, onAutoArrange }: DashboardContextMenuProps) {
  const [showAppSettings, setShowAppSettings] = useState(false);

  // Listen for the custom event to open app settings
  React.useEffect(() => {
    const handleOpenAppSettings = () => {
      setShowAppSettings(true);
    };
    
    document.addEventListener('boxento:openAppSettings', handleOpenAppSettings);
    
    return () => {
      document.removeEventListener('boxento:openAppSettings', handleOpenAppSettings);
    };
  }, []);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger className="h-full w-full outline-none">
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent 
          className="min-w-[220px] overflow-hidden backdrop-blur-sm bg-popover/95 rounded-xl border shadow-lg animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{
            animation: 'contextMenuFadeIn 0.2s ease-out',
          }}
        >
          <ContextMenuGroup>
            <ContextMenuItem
              onClick={onAddWidget}
              className="cursor-pointer group py-2.5 px-3 text-sm hover:bg-primary/10 focus:bg-primary/10 transition-colors data-[highlighted]:bg-primary/10 context-menu-highlight"
            >
              <div className="flex items-center">
                <div className="bg-primary/10 rounded-full p-1.5 mr-3 group-hover:bg-primary/20 group-focus:bg-primary/20 transition-colors">
                  <Plus className="h-4 w-4 text-primary" />
                </div>
                <span>Add Widget</span>
              </div>
            </ContextMenuItem>
            {onAutoArrange && (
              <ContextMenuItem
                onClick={onAutoArrange}
                className="cursor-pointer group py-2.5 px-3 text-sm hover:bg-primary/10 focus:bg-primary/10 transition-colors data-[highlighted]:bg-primary/10 context-menu-highlight"
              >
                <div className="flex items-center">
                  <div className="bg-primary/10 rounded-full p-1.5 mr-3 group-hover:bg-primary/20 group-focus:bg-primary/20 transition-colors">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                  </div>
                  <span>Auto-arrange</span>
                </div>
              </ContextMenuItem>
            )}
          </ContextMenuGroup>
          
          <ContextMenuSeparator className="my-1.5 opacity-50" />
          
          <ContextMenuGroup>
            <ContextMenuLabel className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground">
              Configuration
            </ContextMenuLabel>
            <ContextMenuItem 
              onClick={() => setShowAppSettings(true)} 
              className="cursor-pointer group py-2.5 px-3 text-sm hover:bg-primary/10 focus:bg-primary/10 transition-colors data-[highlighted]:bg-primary/10 context-menu-highlight"
            >
              <div className="flex items-center">
                <div className="bg-primary/10 rounded-full p-1.5 mr-3 group-hover:bg-primary/20 group-focus:bg-primary/20 transition-colors">
                  <Settings2 className="h-4 w-4 text-primary" />
                </div>
                <span>App Settings</span>
              </div>
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
      
      <AppSettingsModal 
        open={showAppSettings} 
        onClose={() => setShowAppSettings(false)} 
      />
    </>
  );
} 