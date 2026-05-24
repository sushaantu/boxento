import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'react-router-dom';
// @ts-expect-error - The types don't correctly represent the module structure
import { Responsive, WidthProvider } from 'react-grid-layout';
import { publicDashboardService, PublicDashboardData } from '@/lib/firestoreService';
import { getWidgetComponent } from '@/components/widgets';
import WidgetErrorBoundary from '@/components/widgets/common/WidgetErrorBoundary';
import { breakpoints, cols } from '@/lib/layoutUtils';
import {
  calculateDashboardRowHeight,
  getDashboardBreakpointForWidth,
} from '@/lib/dashboardViewport';
import { Loader2, Lock, AlertCircle, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase';
import { UserMenuButton } from '@/components/auth/UserMenuButton';
import { Changelog } from '@/components/Changelog';
import { AppFooter } from '@/components/AppFooter';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export function SharedDashboardView() {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const [dashboard, setDashboard] = useState<PublicDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBreakpoint, setCurrentBreakpoint] = useState<keyof typeof cols>(() => (
    typeof window === 'undefined' ? 'lg' : getDashboardBreakpointForWidth(window.innerWidth)
  ));
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Set body class on mount
  useEffect(() => {
    document.body.className = 'app-background min-h-screen';
    return () => { document.body.className = ''; };
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Track window resize
  useEffect(() => {
    const handleResize = () => {
      const nextWidth = window.innerWidth;
      setWindowWidth(nextWidth);
      setCurrentBreakpoint(getDashboardBreakpointForWidth(nextWidth));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const rowHeight = calculateDashboardRowHeight(windowWidth, currentBreakpoint);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    const loadDashboard = async () => {
      if (!dashboardId) {
        setError('Dashboard ID is missing');
        setLoading(false);
        return;
      }

      try {
        const data = await publicDashboardService.loadDashboard(dashboardId);

        if (!data) {
          setError('Dashboard not found');
          setLoading(false);
          return;
        }

        // Check access for team dashboards
        if (data.visibility === 'team') {
          const userEmail = auth?.currentUser?.email;
          if (!publicDashboardService.hasAccess(data, userEmail)) {
            setError('You do not have access to this dashboard');
            setLoading(false);
            return;
          }
        }

        setDashboard(data);
        setLoading(false);
      } catch (err) {
        console.error('Error loading dashboard:', err);
        setError('Failed to load dashboard');
        setLoading(false);
      }
    };

    loadDashboard();
  }, [dashboardId]);

  const renderWidget = (widget: { id: string; type: string }) => {
    const WidgetComponent = getWidgetComponent(widget.type);

    if (!WidgetComponent) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-card rounded-lg text-muted-foreground">
          Unknown widget type
        </div>
      );
    }

    const layoutItem = dashboard?.layouts[currentBreakpoint]?.find(item => item.i === widget.id);
    const width = layoutItem?.w || 2;
    const height = layoutItem?.h || 2;

    const widgetConfig = {
      ...dashboard?.widgetConfigs[widget.id],
      id: widget.id,
      readOnly: true,
    };

    return (
      <WidgetErrorBoundary>
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center bg-card rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }>
          <WidgetComponent
            width={width}
            height={height}
            config={widgetConfig}
          />
        </Suspense>
      </WidgetErrorBoundary>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center app-background">
        <div className="text-center max-w-md mx-auto p-6">
          {error.includes('access') ? (
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          ) : (
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          )}
          <h1 className="text-xl font-semibold mb-2">{error}</h1>
          <p className="text-muted-foreground mb-6">
            {error.includes('access')
              ? 'This dashboard is only shared with specific people.'
              : 'The dashboard you are looking for does not exist or has been removed.'}
          </p>
          <a href="/" className="text-primary hover:underline">
            Go to Boxento
          </a>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <div className={`min-h-screen app-background read-only-dashboard flex flex-col ${theme === 'dark' ? 'dark' : ''}`} data-theme={theme}>
      {/* Header - fixed like main app */}
      <div className="fixed top-0 z-50 w-full backdrop-blur-sm app-header">
        <div className="px-2 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{dashboard.name}</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              View only
            </span>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <Button
              onClick={toggleTheme}
              className="rounded-full h-9 w-9 p-0 flex items-center justify-center"
              size="sm"
              aria-label="Toggle theme"
              variant="outline"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Changelog />

            <div className="flex items-center">
              <UserMenuButton className="h-9" />
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard content */}
      <main className="flex-1 pt-16 md:pt-20">
        <div className="dashboard-canvas">
          <ResponsiveGridLayout
            className="layout"
            layouts={dashboard.layouts}
            breakpoints={breakpoints}
            cols={cols}
            rowHeight={rowHeight}
            isDraggable={false}
            isResizable={false}
            onBreakpointChange={(bp: string) => setCurrentBreakpoint(bp as keyof typeof cols)}
            margin={[15, 15]}
            containerPadding={[10, 10]}
            useCSSTransforms={true}
            compactType="vertical"
            style={{
              width: '100%',
            }}
          >
            {dashboard.widgets.map((widget) => (
              <div key={widget.id} className="widget-wrapper">
                {renderWidget(widget)}
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      </main>

      {/* Footer */}
      <AppFooter />

      {/* CSS to hide interactive elements in read-only mode */}
      <style>{`
        .read-only-dashboard .widget-drag-handle:not(.widget-container),
        .read-only-dashboard .settings-button,
        .read-only-dashboard .widget-settings-trigger,
        .read-only-dashboard [data-add-button],
        .read-only-dashboard .add-task-input,
        .read-only-dashboard .add-link-button {
          display: none !important;
        }
        .read-only-dashboard .widget-card input:not([type="checkbox"]),
        .read-only-dashboard .widget-card textarea {
          pointer-events: none;
          user-select: none;
        }
        .read-only-dashboard .widget-card input[type="checkbox"] {
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

export default SharedDashboardView;
