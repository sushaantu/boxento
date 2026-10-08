import { useEffect, useId, useState, type FC } from 'react';
import { CircleDot, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useSharedCredential } from '@/lib/sharedCredentials';
import { WidgetShell } from '../common/WidgetShell';
import { WidgetSettingsDialog, WidgetSettingsDialogFooter } from '../common/WidgetSettingsDialog';
import { getTennisSnapshot, formatTennisScore, TENNIS_REFRESH_MS } from './api';
import type { TennisMatch, TennisSnapshot, TennisWidgetProps } from './types';

const TennisWidget: FC<TennisWidgetProps> = ({ width, height, config }) => {
  const { credential, updateCredential, removeCredential, isLoading: credentialLoading } = useSharedCredential('livetennis-api');
  const apiKey = credential?.trim() || '';
  const title = config?.title?.trim() || 'Tennis';
  const readOnly = config?.readOnly ?? false;
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isNarrow = width === 1;
  const isCompact = width <= 2 || height <= 2;
  const isPanel = width >= 4 && height >= 4;
  const hideHeader = isTiny || isShort || isNarrow;
  const [snapshot, setSnapshot] = useState<TennisSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftTitle, setDraftTitle] = useState(title);
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  const settingsId = useId();

  useEffect(() => { setSnapshot(null); }, [apiKey]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!apiKey) return;
      setLoading(true);
      try {
        const next = await getTennisSnapshot(apiKey);
        if (active) setSnapshot((previous) => (
          next.error && next.updatedAt === null && previous?.updatedAt
            ? { ...previous, error: next.error }
            : next
        ));
      } catch {
        if (active) setSnapshot({ matches: [], updatedAt: null, error: 'Unable to load tennis scores.' });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, TENNIS_REFRESH_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, [apiKey, refresh]);

  const openSettings = () => {
    setDraftKey(apiKey);
    setDraftTitle(title);
    setShowSettings(true);
  };
  const saveSettings = async () => {
    setSaving(true);
    try {
      if (draftKey.trim()) await updateCredential(draftKey.trim());
      else removeCredential();
      config?.onUpdate?.({ ...config, title: draftTitle.trim() || 'Tennis' });
      setShowSettings(false);
    } finally {
      setSaving(false);
    }
  };
  const matches = snapshot?.matches ?? [];
  const query = search.trim().toLowerCase();
  const filtered = matches.filter((match) => (
    `${match.players.p1.name} ${match.players.p2.name} ${match.tournament}`.toLowerCase().includes(query)
  ));
  const updated = snapshot?.updatedAt
    ? new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const matchCount = `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`;
  const status = credentialLoading ? 'Loading scores' : !apiKey ? 'Add an API key' : loading && !snapshot ? 'Loading scores' : snapshot?.error ? 'Scores unavailable' : matchCount;

  const matchCard = (match: TennisMatch) => {
    if (isNarrow) {
      return (
        <article key={match.id} aria-label="Tennis match" className="min-w-0 space-y-1 rounded-lg bg-muted/40 p-2 text-[10px]">
          <p className="truncate" title={match.players.p1.name}>{match.players.p1.name}</p>
          <p className="truncate text-muted-foreground" title={match.players.p2.name}>{match.players.p2.name}</p>
          <p className="tabular-nums">{match.score?.points.map((point) => point ?? '?').join(' / ') ?? 'Score unavailable'}</p>
        </article>
      );
    }
    return (
      <article key={match.id} aria-label="Tennis match" className="min-w-0 rounded-lg bg-muted/40 p-2 text-xs">
        {!isCompact && <p className="mb-2 truncate text-muted-foreground" title={match.tournament}>{match.tournament}</p>}
        {(['p1', 'p2'] as const).map((player, index) => (
          <div key={player} className="flex min-w-0 items-center gap-2 py-0.5">
            <span className="min-w-0 flex-1 truncate" title={match.players[player].name}>
              {match.players[player].name}
            </span>
            {match.score?.server === index + 1 && (
              <CircleDot className="size-2 shrink-0 text-muted-foreground" aria-label="Serving" />
            )}
            <span className="shrink-0 tabular-nums" aria-label="Sets won">{match.score?.sets[index] ?? '?'}</span>
            <span className="w-5 shrink-0 text-right font-medium tabular-nums" aria-label="Points">
              {match.score?.points[index] ?? '?'}
            </span>
          </div>
        ))}
        {!isCompact && (
          <p className="mt-2 text-muted-foreground">
            {formatTennisScore(match.score)}
            {match.score?.is_tiebreak && <span className="ml-2">Tiebreak</span>}
          </p>
        )}
      </article>
    );
  };

  return (
    <WidgetShell
      title={title}
      icon={<CircleDot className="size-4" />}
      isTiny={isTiny}
      hideHeader={hideHeader}
      compactHeader={isCompact}
      onSettingsClick={!readOnly && !hideHeader ? openSettings : undefined}
      contentClassName="relative flex flex-col"
    >
      {hideHeader && !readOnly && (
        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 z-10 size-6 text-muted-foreground" aria-label="Open widget settings" onClick={openSettings}>
          <Settings2 className="size-3" />
        </Button>
      )}
      {isTiny ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2" title={status} aria-label={status}>
          <CircleDot className="size-3 shrink-0 text-muted-foreground" />
          <span className="text-lg font-semibold leading-6 tabular-nums">{!apiKey || snapshot?.error ? '?' : loading && !snapshot ? '...' : matches.length}</span>
        </div>
      ) : isShort ? (
        <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2 pr-8 text-xs">
          <CircleDot className="size-4 shrink-0 text-muted-foreground" />
          <span className="shrink-0">{status}</span>
          {matches[0] && <span className="truncate text-muted-foreground">{matches[0].players.p1.name} / {matches[0].players.p2.name}</span>}
        </div>
      ) : (
        <div className={`flex min-h-0 flex-1 flex-col gap-2 pb-3 ${isNarrow ? 'pt-8' : ''}`}>
          {!apiKey ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 text-center text-xs text-muted-foreground">
              <CircleDot className="size-6" />
              <p>{credentialLoading ? 'Loading settings' : 'Add a free Live Tennis API key to see score snapshots.'}</p>
              {!readOnly && <Button type="button" variant="outline" size="sm" onClick={openSettings}>Configure</Button>}
            </div>
          ) : loading && !snapshot ? (
            <div className="space-y-2" role="status" aria-label="Loading tennis scores">
              <Skeleton className="h-16 w-full" />
              {!isCompact && <Skeleton className="h-16 w-full" />}
            </div>
          ) : (
            <>
              {isPanel && <Input aria-label="Search tennis matches" placeholder="Search players or tournaments" value={search} onChange={(event) => setSearch(event.target.value)} />}
              {snapshot?.error && <p role="alert" className="text-xs text-destructive">{snapshot.error}</p>}
              <div className={`min-h-0 flex-1 overflow-y-auto ${isPanel ? 'grid content-start gap-3 sm:grid-cols-2' : 'space-y-2'}`}>
                {(isCompact ? filtered.slice(0, 1) : filtered).map(matchCard)}
                {!filtered.length && !snapshot?.error && <p className="p-2 text-center text-xs text-muted-foreground">{query ? 'No matches found' : 'No live matches'}</p>}
              </div>
              <div className="flex min-w-0 shrink-0 items-center justify-between gap-1 text-[10px] text-muted-foreground">
                <span className="min-w-0 truncate" title="Scores refresh every 15 minutes">
                  {updated ? `${snapshot?.error ? 'Last scores' : 'Updated'} ${updated}` : 'Refreshes every 15 min'}
                  {isCompact && matches.length > 1 ? ` · ${matchCount}` : ''}
                </span>
                {!readOnly && <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" disabled={loading} aria-label="Refresh tennis scores" onClick={() => setRefresh((value) => value + 1)}><RefreshCw className="size-3" /></Button>}
              </div>
            </>
          )}
        </div>
      )}
      {!readOnly && (
        <WidgetSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          title="Tennis settings"
          description="Score snapshots refresh every 15 minutes. A free Live Tennis API key is enough."
          footer={<WidgetSettingsDialogFooter onDelete={config?.onDelete} onCancel={() => setShowSettings(false)} onSave={() => { void saveSettings(); }} savePending={saving} />}
        >
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor={`tennis-title-${settingsId}`}>Title</Label><Input id={`tennis-title-${settingsId}`} value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor={`tennis-key-${settingsId}`}>API key</Label><Input id={`tennis-key-${settingsId}`} type="password" autoComplete="off" value={draftKey} onChange={(event) => setDraftKey(event.target.value)} /></div>
            <p className="text-xs text-muted-foreground">This browser shares the key between tennis widgets. It stays outside shared dashboard settings.</p>
          </div>
        </WidgetSettingsDialog>
      )}
    </WidgetShell>
  );
};

export default TennisWidget;
