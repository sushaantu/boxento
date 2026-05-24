import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import WidgetHeader from '../common/WidgetHeader';
import {
  GeographyQuizWidgetProps,
  GeographyQuizWidgetConfig,
  QuizDifficulty,
  QuestionType,
  QuizQuestion,
  QuizRound
} from './types';
import { cn } from '@/lib/utils';
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
  Globe,
  Trophy,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Target,
  Clock,
  BarChart3,
  Trash2
} from 'lucide-react';

// ── Question bank ────────────────────────────────────────────────────────────

const ALL_QUESTIONS: QuizQuestion[] = [
  { id: '1', question: 'What is the capital of France?', options: ['Berlin', 'Paris', 'Rome', 'Madrid'], correctAnswer: 'Paris', type: QuestionType.CAPITALS },
  { id: '2', question: 'What is the capital of Japan?', options: ['Beijing', 'Seoul', 'Tokyo', 'Bangkok'], correctAnswer: 'Tokyo', type: QuestionType.CAPITALS },
  { id: '3', question: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], correctAnswer: 'Canberra', type: QuestionType.CAPITALS },
  { id: '4', question: 'What is the capital of Brazil?', options: ['Rio de Janeiro', 'Brasilia', 'Sao Paulo', 'Salvador'], correctAnswer: 'Brasilia', type: QuestionType.CAPITALS },
  { id: '5', question: 'What is the capital of Canada?', options: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], correctAnswer: 'Ottawa', type: QuestionType.CAPITALS },
  { id: '6', question: 'What is the capital of Egypt?', options: ['Cairo', 'Alexandria', 'Luxor', 'Giza'], correctAnswer: 'Cairo', type: QuestionType.CAPITALS },
  { id: '7', question: 'What is the capital of South Korea?', options: ['Busan', 'Incheon', 'Seoul', 'Daegu'], correctAnswer: 'Seoul', type: QuestionType.CAPITALS },
  { id: '8', question: 'What is the capital of Turkey?', options: ['Istanbul', 'Ankara', 'Izmir', 'Antalya'], correctAnswer: 'Ankara', type: QuestionType.CAPITALS },
  { id: '9', question: 'Which country does this flag belong to? 🍁', options: ['United States', 'Canada', 'Australia', 'New Zealand'], correctAnswer: 'Canada', type: QuestionType.FLAGS },
  { id: '10', question: 'Which country has a flag with a rising sun? 🌅', options: ['China', 'Japan', 'South Korea', 'Vietnam'], correctAnswer: 'Japan', type: QuestionType.FLAGS },
  { id: '11', question: 'Which flag features a Union Jack in the corner? 🇦🇺', options: ['New Zealand', 'Australia', 'Fiji', 'All of these'], correctAnswer: 'All of these', type: QuestionType.FLAGS },
  { id: '12', question: 'Which country has a flag with only green and white?', options: ['Nigeria', 'Pakistan', 'Saudi Arabia', 'Libya'], correctAnswer: 'Nigeria', type: QuestionType.FLAGS },
  { id: '13', question: 'Which of these countries borders Brazil?', options: ['Chile', 'Ecuador', 'Peru', 'Panama'], correctAnswer: 'Peru', type: QuestionType.BORDERS },
  { id: '14', question: 'Which country does NOT border France?', options: ['Belgium', 'Spain', 'Portugal', 'Italy'], correctAnswer: 'Portugal', type: QuestionType.BORDERS },
  { id: '15', question: 'Which country borders both China and India?', options: ['Thailand', 'Myanmar', 'Nepal', 'Bangladesh'], correctAnswer: 'Nepal', type: QuestionType.BORDERS },
  { id: '16', question: 'Which African country borders the most nations?', options: ['Sudan', 'Democratic Republic of Congo', 'Tanzania', 'Kenya'], correctAnswer: 'Democratic Republic of Congo', type: QuestionType.BORDERS },
  { id: '17', question: 'In which country is the Taj Mahal?', options: ['Pakistan', 'India', 'Bangladesh', 'Nepal'], correctAnswer: 'India', type: QuestionType.LANDMARKS },
  { id: '18', question: 'Where is Machu Picchu located?', options: ['Mexico', 'Colombia', 'Peru', 'Bolivia'], correctAnswer: 'Peru', type: QuestionType.LANDMARKS },
  { id: '19', question: 'In which city is the Colosseum?', options: ['Athens', 'Rome', 'Istanbul', 'Cairo'], correctAnswer: 'Rome', type: QuestionType.LANDMARKS },
  { id: '20', question: 'Where is the Great Barrier Reef?', options: ['Indonesia', 'Philippines', 'Australia', 'Thailand'], correctAnswer: 'Australia', type: QuestionType.LANDMARKS },
];

// ── Defaults ─────────────────────────────────────────────────────────────────

const defaultConfig: GeographyQuizWidgetConfig = {
  title: 'Geography Quiz',
  difficulty: QuizDifficulty.MEDIUM,
  questionType: QuestionType.MIXED,
  questionsPerRound: 5,
  history: [],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const getScoreColor = (pct: number) => {
  if (pct >= 0.8) return 'text-green-600 dark:text-green-400';
  if (pct >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

const getScoreEmoji = (pct: number) => {
  if (pct === 1) return 'Perfect!';
  if (pct >= 0.8) return 'Great!';
  if (pct >= 0.5) return 'Good effort';
  return 'Keep trying';
};

const getCategoryLabel = (type: QuestionType) => {
  switch (type) {
    case QuestionType.CAPITALS: return 'Capitals';
    case QuestionType.FLAGS: return 'Flags';
    case QuestionType.BORDERS: return 'Borders';
    case QuestionType.LANDMARKS: return 'Landmarks';
    case QuestionType.MIXED: return 'Mixed';
    default: return 'Mixed';
  }
};

const getOptionStyle = (
  option: string,
  selectedAnswer: string | null,
  correctAnswer: string
) => {
  if (selectedAnswer === null) {
    return 'border-border hover:bg-accent hover:text-accent-foreground';
  }
  if (option === correctAnswer) {
    return 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300';
  }
  if (option === selectedAnswer && option !== correctAnswer) {
    return 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300';
  }
  return 'border-border opacity-50';
};

// ── Component ────────────────────────────────────────────────────────────────

const GeographyQuizWidget: React.FC<GeographyQuizWidgetProps> = ({ width, height, config }) => {
  // --- Size detection ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  // --- State ---
  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<GeographyQuizWidgetConfig>({
    ...defaultConfig,
    ...config,
  });

  // Quiz state
  const [currentQuestions, setCurrentQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizActive, setQuizActive] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // App-mode state
  const [appTab, setAppTab] = useState<'quiz' | 'history' | 'stats'>('quiz');

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // --- Config snapshot for settings modal revert ---
  const [configSnapshot, setConfigSnapshot] = useState<GeographyQuizWidgetConfig | null>(null);

  const handleSettingsOpen = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setConfigSnapshot({ ...localConfig });
    } else if (configSnapshot) {
      setLocalConfig(configSnapshot);
      setConfigSnapshot(null);
    }
    setShowSettings(nextOpen);
  }, [localConfig, configSnapshot]);

  // --- Persist ---
  const saveSettings = useCallback(() => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setConfigSnapshot(null);
    setShowSettings(false);
  }, [config, localConfig]);

  const updateConfig = useCallback((updates: Partial<GeographyQuizWidgetConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    if (config?.onUpdate) {
      config.onUpdate(newConfig);
    }
  }, [config, localConfig]);

  // --- Quiz logic ---
  const getQuestions = useCallback(() => {
    let filtered = ALL_QUESTIONS;
    const type = localConfig.questionType ?? QuestionType.MIXED;
    if (type !== QuestionType.MIXED) {
      filtered = ALL_QUESTIONS.filter(q => q.type === type);
    }
    const shuffled = [...filtered].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, localConfig.questionsPerRound || 5);
  }, [localConfig.questionType, localConfig.questionsPerRound]);

  const startQuiz = useCallback(() => {
    if (readOnly) return;
    const questions = getQuestions();
    setCurrentQuestions(questions);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setQuizActive(true);
    setQuizCompleted(false);
  }, [getQuestions, readOnly]);

  const handleAnswerSelect = useCallback((answer: string) => {
    if (selectedAnswer !== null || readOnly) return;
    setSelectedAnswer(answer);

    const isCorrect = answer === currentQuestions[currentQuestionIndex].correctAnswer;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setTimeout(() => {
      if (currentQuestionIndex < currentQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        setQuizCompleted(true);
        // Save round to history
        const round: QuizRound = {
          id: `round-${Date.now()}`,
          score: isCorrect ? score + 1 : score,
          total: currentQuestions.length,
          date: new Date().toISOString(),
          difficulty: localConfig.difficulty ?? QuizDifficulty.MEDIUM,
          category: localConfig.questionType ?? QuestionType.MIXED,
        };
        const history = [...(localConfig.history || []), round].slice(-50);
        updateConfig({ history });
      }
    }, 1000);
  }, [selectedAnswer, readOnly, currentQuestions, currentQuestionIndex, score, localConfig, updateConfig]);

  // --- Derived data ---
  const history = localConfig.history || [];
  const bestScore = useMemo(() => {
    if (history.length === 0) return null;
    return history.reduce((best, r) => {
      const pct = r.score / r.total;
      const bestPct = best.score / best.total;
      return pct > bestPct ? r : best;
    }, history[0]);
  }, [history]);

  const avgPct = useMemo(() => {
    if (history.length === 0) return 0;
    return history.reduce((sum, r) => sum + r.score / r.total, 0) / history.length;
  }, [history]);

  const totalAnswered = useMemo(
    () => history.reduce((sum, r) => sum + r.total, 0),
    [history]
  );

  const totalCorrect = useMemo(
    () => history.reduce((sum, r) => sum + r.score, 0),
    [history]
  );

  // --- Current question helper ---
  const currentQuestion = currentQuestions[currentQuestionIndex] ?? null;

  // Category breakdown stats (for app stats tab)
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; correct: number; rounds: number }> = {};
    for (const round of history) {
      const key = round.category || QuestionType.MIXED;
      if (!stats[key]) stats[key] = { total: 0, correct: 0, rounds: 0 };
      stats[key].total += round.total;
      stats[key].correct += round.score;
      stats[key].rounds += 1;
    }
    return stats;
  }, [history]);

  // ── Renderers ────────────────────────────────────────────────────────────

  // Shared: answer option button
  const renderOption = (option: string, compact = false) => (
    <Button type="button" variant="ghost" size="none"
      key={option}
      onClick={() => handleAnswerSelect(option)}
      disabled={selectedAnswer !== null || readOnly}
      className={`rounded-lg border text-left transition-colors ${getOptionStyle(
        option,
        selectedAnswer,
        currentQuestion?.correctAnswer ?? ''
      )} ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}`}
    >
      <div className="flex items-center gap-2">
        {selectedAnswer !== null && option === currentQuestion?.correctAnswer && (
          <CheckCircle2 className={`flex-shrink-0 ${compact ? 'h-3 w-3' : 'h-4 w-4'} text-green-500`} />
        )}
        {selectedAnswer === option && option !== currentQuestion?.correctAnswer && (
          <XCircle className={`flex-shrink-0 ${compact ? 'h-3 w-3' : 'h-4 w-4'} text-red-500`} />
        )}
        <span className="truncate">{option}</span>
      </div>
    </Button>
  );

  // Shared: idle state (no quiz active)
  const renderIdle = (compact = false) => (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <Globe className={`text-muted-foreground ${compact ? 'h-5 w-5' : 'h-8 w-8'}`} />
      <p className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
        {readOnly ? 'Geography Quiz' : 'Ready to play?'}
      </p>
      {!readOnly && (
        <Button size="sm" variant="outline" onClick={startQuiz}>
          Start Quiz
        </Button>
      )}
    </div>
  );

  // Shared: completed state
  const renderCompleted = (compact = false) => {
    const pct = currentQuestions.length > 0 ? score / currentQuestions.length : 0;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <Trophy className={`${getScoreColor(pct)} ${compact ? 'h-5 w-5' : 'h-8 w-8'}`} />
        <div className={`font-bold ${getScoreColor(pct)} ${compact ? 'text-lg' : 'text-2xl'}`}>
          {score}/{currentQuestions.length}
        </div>
        <p className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
          {getScoreEmoji(pct)}
        </p>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={startQuiz} className="mt-1">
            <RotateCcw className="mr-1 h-3 w-3" /> Play Again
          </Button>
        )}
      </div>
    );
  };

  // ── 1x1 ICON: globe + best score ──────────────────────────────────────

  const renderTiny = () => (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <Globe className="h-5 w-5 text-muted-foreground" />
      <div className="text-lg font-semibold leading-none text-foreground">
        {quizActive && !quizCompleted
          ? `${score}`
          : history.length > 0
            ? `${Math.round(avgPct * 100)}%`
            : '?'}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {quizActive && !quizCompleted ? 'score' : history.length > 0 ? 'avg' : 'quiz'}
      </div>
    </div>
  );

  // ── Nx1 RIBBON: score + current question preview ──────────────────────

  const renderShort = () => (
    <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
      <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 font-medium text-foreground dark:bg-white/[0.06]">
        <Globe className="mr-1 inline h-3 w-3" />
        {history.length > 0 ? `${Math.round(avgPct * 100)}% avg` : 'Quiz'}
      </span>
      {quizActive && !quizCompleted && currentQuestion && (
        <>
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
            Q{currentQuestionIndex + 1}/{currentQuestions.length}
          </span>
          <span className="shrink-0 truncate text-muted-foreground" style={{ maxWidth: '16rem' }}>
            {currentQuestion.question}
          </span>
        </>
      )}
      {quizCompleted && (
        <span className={`shrink-0 rounded-full px-2 py-1 font-medium ${getScoreColor(score / currentQuestions.length)}`}>
          {score}/{currentQuestions.length} correct
        </span>
      )}
      {!quizActive && history.length > 0 && (
        <span className="shrink-0 text-muted-foreground">
          {history.length} rounds played
        </span>
      )}
      {!readOnly && !quizActive && (
        <Button size="sm" variant="outline" className="shrink-0 h-6 text-xs px-2" onClick={startQuiz}>
          Play
        </Button>
      )}
    </div>
  );

  // ── 2x2 COMPACT: question + 2x2 grid answers ─────────────────────────

  const renderCompact = () => {
    if (!quizActive) return renderIdle(true);
    if (quizCompleted) return renderCompleted(true);

    return (
      <div className="flex h-full flex-col justify-between gap-1">
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Q{currentQuestionIndex + 1}/{currentQuestions.length}</span>
            <span>{score} pts</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs font-medium text-foreground">
            {currentQuestion?.question}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {currentQuestion?.options.map(opt => renderOption(opt, true))}
        </div>
      </div>
    );
  };

  // ── 3x3 DEFAULT WIDGET: balanced quiz experience ──────────────────────

  const renderDefault = () => {
    if (!quizActive) return renderIdle();
    if (quizCompleted) return renderCompleted();

    return (
      <div className="flex h-full flex-col justify-between gap-2">
        <div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="font-medium">
              Question {currentQuestionIndex + 1}/{currentQuestions.length}
            </span>
            <span className="font-medium">Score: {score}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">
            {currentQuestion?.question}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {currentQuestion?.options.map(opt => renderOption(opt))}
        </div>
      </div>
    );
  };

  // ── 4x4-5x5 PANEL: quiz + stats sidebar ──────────────────────────────

  const renderPanel = () => (
    <div className="flex h-full gap-3 overflow-hidden">
      {/* Main quiz area */}
      <div className="flex flex-1 flex-col justify-between overflow-hidden">
        {!quizActive ? renderIdle() : quizCompleted ? renderCompleted() : (
          <div className="flex h-full flex-col justify-between gap-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Question {currentQuestionIndex + 1}/{currentQuestions.length}
                </span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Score: {score}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%` }}
                />
              </div>
              <p className="mt-3 text-base font-medium text-foreground">
                {currentQuestion?.question}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {currentQuestion?.options.map(opt => renderOption(opt))}
            </div>
          </div>
        )}
      </div>

      {/* Stats sidebar */}
      <div className="w-2/5 overflow-y-auto border-l border-border pl-3">
        <div className="space-y-3 py-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stats</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Accuracy</span>
              <span className="ml-auto text-xs font-semibold">{totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0}%</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Rounds</span>
              <span className="ml-auto text-xs font-semibold">{history.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Best</span>
              <span className="ml-auto text-xs font-semibold">
                {bestScore ? `${bestScore.score}/${bestScore.total}` : '--'}
              </span>
            </div>
          </div>

          {history.length > 0 && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Recent</div>
              <div className="space-y-1">
                {history.slice(-5).reverse().map(round => (
                  <div key={round.id} className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                    <span className={`font-medium ${getScoreColor(round.score / round.total)}`}>
                      {round.score}/{round.total}
                    </span>
                    <span className="text-muted-foreground">{getCategoryLabel(round.category)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ── 6x6+ APP: full application with tabs, history, detailed stats ─────

  const renderApp = () => (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex px-2 widget-drag-handle cursor-move">
        {(['quiz', 'history', 'stats'] as const).map(tab => (
          <Button
            key={tab}
            variant="ghost"
            className={`px-3 py-2 text-sm capitalize rounded-none transition-colors ${
              appTab === tab
                ? 'border-b-2 border-primary font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setAppTab(tab)}
          >
            {tab}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {appTab === 'quiz' && renderAppQuizTab()}
        {appTab === 'history' && renderAppHistoryTab()}
        {appTab === 'stats' && renderAppStatsTab()}
      </div>
    </div>
  );

  const renderAppQuizTab = () => {
    if (!quizActive) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <Globe className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">Geography Quiz</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Test your knowledge of world geography
              </p>
            </div>

            {/* Category selection */}
            {!readOnly && (
              <div className="flex flex-wrap justify-center gap-2">
                {[QuestionType.MIXED, QuestionType.CAPITALS, QuestionType.FLAGS, QuestionType.BORDERS, QuestionType.LANDMARKS].map(type => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    onClick={() => updateConfig({ questionType: type })}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      localConfig.questionType === type
                        ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {getCategoryLabel(type)}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                <span>{getCategoryLabel(localConfig.questionType ?? QuestionType.MIXED)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4" />
                <span>{localConfig.questionsPerRound ?? 5} questions</span>
              </div>
            </div>

            {!readOnly && (
              <Button onClick={startQuiz} className="mt-2">
                <Globe className="mr-2 h-4 w-4" /> Start Quiz
              </Button>
            )}
          </div>
        </div>
      );
    }

    if (quizCompleted) {
      const pct = currentQuestions.length > 0 ? score / currentQuestions.length : 0;
      return (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <Trophy className={`h-16 w-16 ${getScoreColor(pct)}`} />
            <div>
              <h2 className="text-3xl font-bold text-foreground">{score}/{currentQuestions.length}</h2>
              <p className={`mt-1 text-lg font-medium ${getScoreColor(pct)}`}>{getScoreEmoji(pct)}</p>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">{Math.round(pct * 100)}%</div>
                <div className="text-xs">Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">{history.length}</div>
                <div className="text-xs">Total rounds</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">{Math.round(avgPct * 100)}%</div>
                <div className="text-xs">Overall avg</div>
              </div>
            </div>
            {!readOnly && (
              <Button onClick={startQuiz} variant="outline" className="mt-2">
                <RotateCcw className="mr-2 h-4 w-4" /> Play Again
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Active quiz — center layout
    return (
      <div className="mx-auto flex h-full max-w-xl flex-col justify-between gap-4 p-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Question {currentQuestionIndex + 1} of {currentQuestions.length}
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              Score: {score}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%` }}
            />
          </div>
          <p className="mt-4 text-lg font-medium text-foreground">
            {currentQuestion?.question}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {currentQuestion?.options.map(opt => (
            <Button type="button" variant="ghost" size="none"
              key={opt}
              onClick={() => handleAnswerSelect(opt)}
              disabled={selectedAnswer !== null || readOnly}
              className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${getOptionStyle(
                opt,
                selectedAnswer,
                currentQuestion?.correctAnswer ?? ''
              )}`}
            >
              <div className="flex items-center gap-2">
                {selectedAnswer !== null && opt === currentQuestion?.correctAnswer && (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                )}
                {selectedAnswer === opt && opt !== currentQuestion?.correctAnswer && (
                  <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                )}
                <span>{opt}</span>
              </div>
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const renderAppHistoryTab = () => {
    if (history.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <Clock className="h-8 w-8" />
          <p className="text-sm">No quiz history yet</p>
          <p className="text-xs">Complete a quiz round to see results here</p>
        </div>
      );
    }

    return (
      <div className="p-4">
        <div className="space-y-2">
          {[...history].reverse().map((round, i) => {
            const pct = round.score / round.total;
            return (
              <div key={round.id} className="flex items-center gap-4 rounded-lg border border-border p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                  {history.length - i}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${getScoreColor(pct)}`}>
                      {round.score}/{round.total}
                    </span>
                    <span className="text-xs text-muted-foreground">({Math.round(pct * 100)}%)</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{getScoreEmoji(pct)}</span>
                  </div>
                  <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                    <span>{getCategoryLabel(round.category)}</span>
                    <span>{new Date(round.date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!readOnly && history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => updateConfig({ history: [] })}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Clear History
          </Button>
        )}
      </div>
    );
  };

  const renderAppStatsTab = () => {
    if (history.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <BarChart3 className="h-8 w-8" />
          <p className="text-sm">No stats yet</p>
          <p className="text-xs">Play some rounds to see your statistics</p>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{history.length}</div>
            <div className="text-xs text-muted-foreground">Rounds</div>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{totalAnswered}</div>
            <div className="text-xs text-muted-foreground">Questions</div>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <div className={`text-2xl font-bold ${getScoreColor(avgPct)}`}>{Math.round(avgPct * 100)}%</div>
            <div className="text-xs text-muted-foreground">Avg accuracy</div>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-2xl font-bold text-foreground">
              {bestScore ? `${bestScore.score}/${bestScore.total}` : '--'}
            </div>
            <div className="text-xs text-muted-foreground">Best score</div>
          </div>
        </div>

        {/* Category breakdown */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Category breakdown</h3>
          <div className="space-y-2">
            {Object.entries(categoryStats).map(([cat, data]) => {
              const pct = data.total > 0 ? data.correct / data.total : 0;
              return (
                <div key={cat} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{getCategoryLabel(cat as QuestionType)}</span>
                    <span className={`text-sm font-semibold ${getScoreColor(pct)}`}>{Math.round(pct * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 0.8 ? 'bg-green-500' : pct >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {data.correct}/{data.total} correct across {data.rounds} rounds
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Settings modal ─────────────────────────────────────────────────────

  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={handleSettingsOpen}>
      <DialogContent className="settings-dialog-content sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{localConfig.title || 'Geography Quiz'} Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="gq-title">Title</Label>
            <Input
              id="gq-title"
              value={localConfig.title || ''}
              onChange={(e) =>
                setLocalConfig(prev => ({ ...prev, title: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="gq-difficulty">Difficulty</Label>
            <Select
              value={localConfig.difficulty ?? QuizDifficulty.MEDIUM}
              onValueChange={(value) =>
                setLocalConfig(prev => ({ ...prev, difficulty: value as QuizDifficulty }))
              }
            >
              <SelectTrigger id="gq-difficulty">
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                <SelectItem value={QuizDifficulty.EASY}>Easy</SelectItem>
                <SelectItem value={QuizDifficulty.MEDIUM}>Medium</SelectItem>
                <SelectItem value={QuizDifficulty.HARD}>Hard</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="gq-type">Question Type</Label>
            <Select
              value={localConfig.questionType ?? QuestionType.MIXED}
              onValueChange={(value) =>
                setLocalConfig(prev => ({ ...prev, questionType: value as QuestionType }))
              }
            >
              <SelectTrigger id="gq-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                <SelectItem value={QuestionType.MIXED}>Mixed</SelectItem>
                <SelectItem value={QuestionType.CAPITALS}>Capitals</SelectItem>
                <SelectItem value={QuestionType.FLAGS}>Flags</SelectItem>
                <SelectItem value={QuestionType.BORDERS}>Borders</SelectItem>
                <SelectItem value={QuestionType.LANDMARKS}>Landmarks</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="gq-count">Questions per Round</Label>
            <Input
              id="gq-count"
              type="number"
              min={1}
              max={20}
              value={localConfig.questionsPerRound ?? 5}
              onChange={(e) =>
                setLocalConfig(prev => ({
                  ...prev,
                  questionsPerRound: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 5))
                }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>
                Delete Widget
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={() => handleSettingsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveSettings}>Save</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Main render ────────────────────────────────────────────────────────

  const settingsClick = readOnly ? undefined : () => setShowSettings(true);

  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title}
          onSettingsClick={settingsClick}
          compact={isShort}
        />
      )}

      <div className={`flex-1 overflow-hidden ${isTiny ? 'p-2' : isShort ? 'px-1' : ''}`}>
        {isTiny ? renderTiny()
          : isShort ? renderShort()
          : isApp ? renderApp()
          : isWide && isTall ? renderPanel()
          : isCompact ? renderCompact()
          : renderDefault()}
      </div>

      {!readOnly && renderSettings()}
    </div>
  );
};

export default GeographyQuizWidget;
