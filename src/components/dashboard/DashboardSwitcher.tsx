import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, Plus, Settings2, Lock, Globe, Users, Copy, Check, Trash2 } from 'lucide-react';

export type DashboardVisibility = 'private' | 'team' | 'public';
export type ShareRole = 'viewer' | 'editor';

export interface SharedUser {
  email: string;
  role: ShareRole;
}

export interface Dashboard {
  id: string;
  name: string;
  visibility: DashboardVisibility;
  sharedWith: SharedUser[];
  isDefault?: boolean;
  createdAt: string;
  ownerId?: string;
}

interface DashboardSwitcherProps {
  dashboards: Dashboard[];
  currentDashboard: Dashboard;
  onSwitchDashboard: (dashboard: Dashboard) => void;
  onCreateDashboard: (name: string, visibility: DashboardVisibility) => void;
  onUpdateDashboard: (dashboard: Dashboard) => void;
  onDeleteDashboard: (dashboardId: string) => void;
}

const VisibilityIcon = ({ visibility }: { visibility: DashboardVisibility }) => {
  switch (visibility) {
    case 'public':
      return <Globe className="h-4 w-4 text-green-500" />;
    case 'team':
      return <Users className="h-4 w-4 text-blue-500" />;
    case 'private':
    default:
      return <Lock className="h-4 w-4 text-muted-foreground" />;
  }
};

export function DashboardSwitcher({
  dashboards,
  currentDashboard,
  onSwitchDashboard,
  onCreateDashboard,
  onUpdateDashboard,
  onDeleteDashboard,
}: DashboardSwitcherProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [newDashboardVisibility, setNewDashboardVisibility] = useState<DashboardVisibility>('private');
  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState<DashboardVisibility>('private');
  const [copied, setCopied] = useState(false);

  const handleCreateDashboard = () => {
    if (newDashboardName.trim()) {
      onCreateDashboard(newDashboardName.trim(), newDashboardVisibility);
      setNewDashboardName('');
      setNewDashboardVisibility('private');
      setShowCreateDialog(false);
    }
  };

  const handleOpenSettings = () => {
    setEditName(currentDashboard.name);
    setEditVisibility(currentDashboard.visibility);
    setShowSettingsDialog(true);
  };

  const handleSaveSettings = () => {
    onUpdateDashboard({
      ...currentDashboard,
      name: editName.trim() || currentDashboard.name,
      visibility: editVisibility,
    });
    setShowSettingsDialog(false);
  };

  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/d/${currentDashboard.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteDashboard = () => {
    if (confirm(`Are you sure you want to delete "${currentDashboard.name}"? This cannot be undone.`)) {
      onDeleteDashboard(currentDashboard.id);
      setShowSettingsDialog(false);
    }
  };

  const otherDashboards = dashboards.filter(d => d.id !== currentDashboard.id);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 text-lg font-semibold hover:text-gray-700 dark:hover:text-gray-300 transition-colors focus:outline-none">
            {currentDashboard.name}
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Current Dashboard
          </DropdownMenuLabel>
          <DropdownMenuItem className="flex items-center justify-between" disabled>
            <span className="font-medium">{currentDashboard.name}</span>
            <VisibilityIcon visibility={currentDashboard.visibility} />
          </DropdownMenuItem>

          {otherDashboards.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Switch To
              </DropdownMenuLabel>
              {otherDashboards.map((dashboard) => (
                <DropdownMenuItem
                  key={dashboard.id}
                  onClick={() => onSwitchDashboard(dashboard)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span>{dashboard.name}</span>
                  <VisibilityIcon visibility={dashboard.visibility} />
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowCreateDialog(true)}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Dashboard
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleOpenSettings}
            className="cursor-pointer"
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Dashboard Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Dashboard Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="settings-dialog-content sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Dashboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dashboard-name">Dashboard Name</Label>
              <Input
                id="dashboard-name"
                placeholder="e.g., Work Setup, Gaming, Travel"
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateDashboard()}
              />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={newDashboardVisibility}
                onValueChange={(v) => setNewDashboardVisibility(v as DashboardVisibility)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      <span>Private</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>Public</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {newDashboardVisibility === 'private' && 'Only you can view this dashboard'}
                {newDashboardVisibility === 'public' && 'Anyone with the link can view'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDashboard} disabled={!newDashboardName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dashboard Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="settings-dialog-content sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dashboard Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Dashboard Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
                <Select
                  value={editVisibility}
                  onValueChange={(v) => setEditVisibility(v as DashboardVisibility)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        <span>Private</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="public">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>Public</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {editVisibility === 'private' && 'Only you can view this dashboard'}
                  {editVisibility === 'public' && 'Anyone with the link can view'}
                </p>
            </div>

            {/* Share link for public dashboards */}
            {editVisibility === 'public' && (
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/d/${currentDashboard.id}`}
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyShareLink}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            {!currentDashboard.isDefault && (
              <Button
                variant="destructive"
                onClick={handleDeleteDashboard}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSettings}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
