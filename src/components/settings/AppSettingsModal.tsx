import { useAppSettings } from '@/context/AppSettingsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Palette, Image } from 'lucide-react';

// Import types
type FaviconMode = 'simple' | 'smart';
type ThemeMode = 'light' | 'dark' | 'system';

interface AppSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function AppSettingsModal({ open, onClose }: AppSettingsModalProps) {
  const { settings, updateSettings } = useAppSettings();
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="settings-dialog-content max-w-md">
        <DialogHeader>
          <DialogTitle>App Settings</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="appearance">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span>Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="favicon" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              <span>Favicon</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="appearance" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Theme Mode</Label>
                <RadioGroup 
                  value={settings.themeMode}
                  onValueChange={(value) => updateSettings({ themeMode: value as ThemeMode })}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="theme-light" />
                    <Label htmlFor="theme-light">Light</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="theme-dark" />
                    <Label htmlFor="theme-dark">Dark</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="theme-system" />
                    <Label htmlFor="theme-system">System (Auto)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="favicon" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Favicon Mode</Label>
              <RadioGroup 
                value={settings.faviconMode}
                onValueChange={(value) => updateSettings({ faviconMode: value as FaviconMode })}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="simple" id="favicon-simple" />
                  <Label htmlFor="favicon-simple">Simple Favicon (static)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="smart" id="favicon-smart" />
                  <Label htmlFor="favicon-smart">Smart Favicon (dynamic based on widgets)</Label>
                </div>
              </RadioGroup>
              
              <p className="text-sm text-muted-foreground mt-2">
                Smart favicon will show temperature for weather widget, timer for pomodoro, etc.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 