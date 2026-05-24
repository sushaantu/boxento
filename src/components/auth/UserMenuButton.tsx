import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import type { AuthContextType } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { User, LogOut, Mail } from 'lucide-react';
import { AuthForm } from './AuthForm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { isFirebaseInitialized } from '@/lib/firebase';

interface UserMenuButtonProps {
  className?: string;
}

export function UserMenuButton({ className }: UserMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const { currentUser, logout } = useAuth() as AuthContextType;

  // Show local-only mode indicator if Firebase is not configured
  if (!isFirebaseInitialized) {
    return (
      <div className={`text-xs text-gray-500 dark:text-gray-400 px-2 py-1 rounded ${className}`}>
        Local Mode
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleLoginSuccess = () => {
    setOpen(false);
  };

  // Get user initials for avatar fallback
  const getUserInitials = (): string => {
    if (!currentUser) return '';

    if (currentUser.displayName) {
      // Extract initials from display name
      return currentUser.displayName
        .split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }

    // If no display name, use first character of email
    if (currentUser.email) {
      return currentUser.email[0].toUpperCase();
    }

    return 'U'; // Default fallback
  };

  return (
    <>
      {currentUser ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className={`rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white ${className} flex items-center gap-2`}
              size="sm"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage
                  src={currentUser.photoURL || undefined}
                  alt={currentUser.displayName || 'User avatar'}
                />
                <AvatarFallback className="bg-blue-600 dark:bg-blue-700 text-white text-xs">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              {/* Hide text on xs screens, show on sm and larger */}
              <span className="hidden sm:inline">My Profile</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <DropdownMenuLabel className="text-gray-900 dark:text-white">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
            <DropdownMenuItem className="gap-2 text-gray-700 dark:text-gray-300 focus:bg-gray-100 dark:focus:bg-gray-700">
              <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="truncate">{currentUser.email}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
            <DropdownMenuItem
              variant="destructive"
              onClick={handleLogout}
              className="gap-2 text-red-600 dark:text-red-400 focus:bg-gray-100 dark:focus:bg-gray-700"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={`rounded-full ${className} flex items-center gap-2`}
        >
          <User className="h-4 w-4" />
          {/* Hide text on xs screens, show on sm and larger */}
          <span className="hidden sm:inline">Login</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700">
          <AuthForm onSuccess={handleLoginSuccess} />
        </DialogContent>
      </Dialog>
    </>
  );
}
