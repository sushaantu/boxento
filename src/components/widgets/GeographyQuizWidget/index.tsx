import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import { GeographyQuizWidgetProps, GeographyQuizWidgetConfig, QuizDifficulty, QuestionType, QuizQuestion } from './types';
import { Globe } from 'lucide-react';

/**
 * Size categories for widget content rendering
 * This enum provides clear naming for different widget dimensions
 */
enum WidgetSizeCategory {
  SMALL = 'small',         // 2x2
  WIDE_SMALL = 'wideSmall', // 3x2 
  TALL_SMALL = 'tallSmall', // 2x3
  MEDIUM = 'medium',       // 3x3
  WIDE_MEDIUM = 'wideMedium', // 4x3
  TALL_MEDIUM = 'tallMedium', // 3x4
  LARGE = 'large'          // 4x4
}

// Mock quiz questions (in a real implementation, this could be fetched from an API)
const SAMPLE_QUESTIONS: QuizQuestion[] = [
  {
    id: '1',
    question: 'What is the capital of France?',
    options: ['Berlin', 'Paris', 'Rome', 'Madrid'],
    correctAnswer: 'Paris',
    type: QuestionType.CAPITALS
  },
  {
    id: '2',
    question: 'What is the capital of Japan?',
    options: ['Beijing', 'Seoul', 'Tokyo', 'Bangkok'],
    correctAnswer: 'Tokyo',
    type: QuestionType.CAPITALS
  },
  {
    id: '3',
    question: 'Which country does this flag belong to?',
    image: 'https://flagcdn.com/w320/ca.png',
    options: ['United States', 'Canada', 'Australia', 'New Zealand'],
    correctAnswer: 'Canada',
    type: QuestionType.FLAGS
  },
  {
    id: '4',
    question: 'Which of these countries borders Brazil?',
    options: ['Chile', 'Ecuador', 'Peru', 'Panama'],
    correctAnswer: 'Peru',
    type: QuestionType.BORDERS
  },
  {
    id: '5',
    question: 'In which country would you find the Taj Mahal?',
    options: ['Pakistan', 'India', 'Bangladesh', 'Nepal'],
    correctAnswer: 'India',
    type: QuestionType.LANDMARKS
  }
];

/**
 * Geography Quiz Widget Component
 * 
 * A widget that presents geography quiz questions to the user with
 * multiple choice answers and tracks their score.
 * 
 * @param {GeographyQuizWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const GeographyQuizWidget: React.FC<GeographyQuizWidgetProps> = ({ width, height, config }) => {
  // Default configuration
  const defaultConfig: GeographyQuizWidgetConfig = {
    title: 'Geography Quiz',
    difficulty: QuizDifficulty.MEDIUM,
    questionType: QuestionType.MIXED,
    questionsPerRound: 5
  };

  // Component state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<GeographyQuizWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  
  // Quiz state
  const [currentQuestions, setCurrentQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [quizActive, setQuizActive] = useState<boolean>(false);
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);
  
  // Ref for the widget container
  const widgetRef = useRef<HTMLDivElement | null>(null);
  
  // Update local config when props config changes
  useEffect(() => {
    setLocalConfig((prevConfig: GeographyQuizWidgetConfig) => ({
      ...prevConfig,
      ...config
    }));
  }, [config]);
  
  // Function to get a filtered and shuffled set of questions based on settings
  const getQuestions = () => {
    // Filter questions by type if needed
    let filteredQuestions = SAMPLE_QUESTIONS;
    if (localConfig.questionType && localConfig.questionType !== QuestionType.MIXED) {
      filteredQuestions = SAMPLE_QUESTIONS.filter(q => q.type === localConfig.questionType);
    }
    
    // Shuffle the questions
    const shuffled = [...filteredQuestions].sort(() => 0.5 - Math.random());
    
    // Get the number of questions needed for the round
    return shuffled.slice(0, localConfig.questionsPerRound || 5);
  };
  
  // Start a new quiz round
  const startQuiz = () => {
    const questions = getQuestions();
    setCurrentQuestions(questions);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setQuizActive(true);
    setQuizCompleted(false);
  };
  
  // Handle answer selection
  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer !== null) return; // Prevent multiple selections
    
    setSelectedAnswer(answer);
    
    // Check if answer is correct
    if (answer === currentQuestions[currentQuestionIndex].correctAnswer) {
      setScore(prev => prev + 1);
    }
    
    // Move to next question after a delay
    setTimeout(() => {
      if (currentQuestionIndex < currentQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        // Quiz completed
        setQuizCompleted(true);
      }
    }, 1000);
  };
  
  /**
   * Determines the appropriate size category based on width and height
   * 
   * @param width - Widget width in grid units
   * @param height - Widget height in grid units
   * @returns The corresponding WidgetSizeCategory
   */
  const getWidgetSizeCategory = (width: number, height: number): WidgetSizeCategory => {
    if (width >= 4 && height >= 4) {
      return WidgetSizeCategory.LARGE;
    } else if (width >= 4 && height >= 3) {
      return WidgetSizeCategory.WIDE_MEDIUM;
    } else if (width >= 3 && height >= 4) {
      return WidgetSizeCategory.TALL_MEDIUM;
    } else if (width >= 3 && height >= 3) {
      return WidgetSizeCategory.MEDIUM;
    } else if (width >= 3 && height >= 2) {
      return WidgetSizeCategory.WIDE_SMALL;
    } else if (width >= 2 && height >= 3) {
      return WidgetSizeCategory.TALL_SMALL;
    } else {
      return WidgetSizeCategory.SMALL;
    }
  };
  
  // Render content based on widget size
  const renderContent = () => {
    const sizeCategory = getWidgetSizeCategory(width, height);
    
    switch (sizeCategory) {
      case WidgetSizeCategory.SMALL:
        return renderSmallView();
      case WidgetSizeCategory.WIDE_SMALL:
        return renderWideSmallView();
      case WidgetSizeCategory.TALL_SMALL:
        return renderTallSmallView();
      case WidgetSizeCategory.MEDIUM:
        return renderMediumView();
      case WidgetSizeCategory.WIDE_MEDIUM:
        return renderWideMediumView();
      case WidgetSizeCategory.TALL_MEDIUM:
        return renderTallMediumView();
      case WidgetSizeCategory.LARGE:
        return renderLargeView();
      default:
        return renderSmallView();
    }
  };
  
  // Small view (2x2) - just start quiz button or quiz summary
  const renderSmallView = () => {
    if (!quizActive) {
      return (
        <div className="h-full flex flex-col justify-center items-center text-center">
          {/* Use Globe icon from Lucide with consistent styling */}
          <Globe size={24} className="text-gray-400 mb-3" strokeWidth={1.5} />
          {/* Consistent text styling */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Ready for a geography challenge?
          </p>
          {/* Consistent button styling */}
          <Button
            size="sm"
            onClick={startQuiz}
            variant="outline"
          >
            Start Quiz
          </Button>
        </div>
      );
    }

    if (quizCompleted) {
      return (
        <div className="h-full flex flex-col justify-center items-center text-center space-y-2">
          <h3 className="font-medium">Quiz Completed!</h3>
          <p>Score: {score}/{currentQuestions.length}</p>
          <button 
            onClick={startQuiz}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            New Quiz
          </button>
        </div>
      );
    }
    
    return (
      <div className="h-full flex flex-col justify-between">
        <div className="text-center mb-2">
          <span className="text-xs font-medium">Question {currentQuestionIndex + 1}/{currentQuestions.length}</span>
          <h3 className="text-sm font-medium line-clamp-2">{currentQuestions[currentQuestionIndex]?.question}</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-1">
          {currentQuestions[currentQuestionIndex]?.options.map((option) => (
            <button
              key={option}
              onClick={() => handleAnswerSelect(option)}
              className={`p-1 text-xs rounded-md border ${
                selectedAnswer === null 
                  ? 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700' 
                  : selectedAnswer === option
                    ? option === currentQuestions[currentQuestionIndex].correctAnswer
                      ? 'bg-green-100 border-green-500 dark:bg-green-800 dark:bg-opacity-30 dark:border-green-600'
                      : 'bg-red-100 border-red-500 dark:bg-red-800 dark:bg-opacity-30 dark:border-red-600'
                    : option === currentQuestions[currentQuestionIndex].correctAnswer && selectedAnswer !== null
                      ? 'bg-green-100 border-green-500 dark:bg-green-800 dark:bg-opacity-30 dark:border-green-600'
                      : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  // Wide Small view (3x2) - Includes quiz image if available
  const renderWideSmallView = () => {
    if (!quizActive) {
      return (
        <div className="h-full flex flex-col justify-center items-center text-center">
          {/* Use Globe icon from Lucide with consistent styling */}
          <Globe size={24} className="text-gray-400 mb-3" strokeWidth={1.5} />
          {/* Consistent text styling */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Test your geography knowledge!
          </p>
          {/* Consistent button styling */}
          <Button
            size="sm"
            onClick={startQuiz}
            variant="outline"
          >
            Start Quiz
          </Button>
        </div>
      );
    }

    if (quizCompleted) {
      return (
        <div className="h-full flex flex-col justify-center items-center text-center space-y-3">
          <h3 className="font-medium">Quiz Completed!</h3>
          <p>Score: {score}/{currentQuestions.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {score === currentQuestions.length ? "Perfect score! You're a geography master!" : 
             score >= currentQuestions.length * 0.7 ? "Great job!" :
             score >= currentQuestions.length * 0.5 ? "Good effort!" :
             "Better luck next time!"}
          </p>
          <button 
            onClick={startQuiz}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            New Quiz
          </button>
        </div>
      );
    }
    
    const currentQuestion = currentQuestions[currentQuestionIndex];
    
    return (
      <div className="h-full flex flex-col justify-between">
        <div className="mb-2">
          <div className="flex justify-between items-center text-xs mb-1">
            <span>Question {currentQuestionIndex + 1}/{currentQuestions.length}</span>
            <span>Score: {score}</span>
          </div>
          
          <div className="flex space-x-2">
            {currentQuestion?.image && (
              <div className="w-1/3">
                <img 
                  src={currentQuestion.image} 
                  alt="Quiz" 
                  className="w-full h-auto object-contain border rounded-md" 
                />
              </div>
            )}
            
            <div className={currentQuestion?.image ? "w-2/3" : "w-full"}>
              <h3 className="text-sm font-medium">{currentQuestion?.question}</h3>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {currentQuestion?.options.map((option) => (
            <button
              key={option}
              onClick={() => handleAnswerSelect(option)}
              className={`py-1 px-2 text-sm rounded-md border ${
                selectedAnswer === null 
                  ? 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700' 
                  : selectedAnswer === option
                    ? option === currentQuestion.correctAnswer
                      ? 'bg-green-100 border-green-500 dark:bg-green-800 dark:bg-opacity-30 dark:border-green-600'
                      : 'bg-red-100 border-red-500 dark:bg-red-800 dark:bg-opacity-30 dark:border-red-600'
                    : option === currentQuestion.correctAnswer && selectedAnswer !== null
                      ? 'bg-green-100 border-green-500 dark:bg-green-800 dark:bg-opacity-30 dark:border-green-600'
                      : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  // Tall Small view (2x3) - More vertical space for options
  const renderTallSmallView = () => {
    if (!quizActive) {
      return (
        <div className="h-full flex flex-col justify-center items-center text-center">
          {/* Use Globe icon from Lucide with consistent styling */}
          <Globe size={24} className="text-gray-400 mb-3" strokeWidth={1.5} />
          {/* Consistent text styling */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Test your geography knowledge!
          </p>
          {/* Consistent button styling */}
          <Button
            size="sm"
            onClick={startQuiz}
            variant="outline"
          >
            Start Quiz
          </Button>
        </div>
      );
    }

    if (quizCompleted) {
      return (
        <div className="h-full flex flex-col justify-center items-center text-center space-y-3">
          <h3 className="font-medium">Quiz Completed!</h3>
          <p>Score: {score}/{currentQuestions.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {score === currentQuestions.length ? "Perfect score! You're a geography master!" : 
             score >= currentQuestions.length * 0.7 ? "Great job!" :
             score >= currentQuestions.length * 0.5 ? "Good effort!" :
             "Better luck next time!"}
          </p>
          <button 
            onClick={startQuiz}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            New Quiz
          </button>
        </div>
      );
    }
    
    const currentQuestion = currentQuestions[currentQuestionIndex];
    
    return (
      <div className="h-full flex flex-col justify-between">
        <div className="mb-2">
          <div className="flex justify-between items-center text-xs mb-1">
            <span>Question {currentQuestionIndex + 1}/{currentQuestions.length}</span>
            <span>Score: {score}</span>
          </div>
          
          <h3 className="text-sm font-medium mb-2">{currentQuestion?.question}</h3>
          
          {currentQuestion?.image && (
            <div className="mb-2">
              <img 
                src={currentQuestion.image} 
                alt="Quiz" 
                className="w-full h-auto object-contain border rounded-md" 
              />
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          {currentQuestion?.options.map((option) => (
            <button
              key={option}
              onClick={() => handleAnswerSelect(option)}
              className={`py-2 px-3 text-sm rounded-md border ${
                selectedAnswer === null 
                  ? 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700' 
                  : selectedAnswer === option
                    ? option === currentQuestion.correctAnswer
                      ? 'bg-green-100 border-green-500 dark:bg-green-800 dark:bg-opacity-30 dark:border-green-600'
                      : 'bg-red-100 border-red-500 dark:bg-red-800 dark:bg-opacity-30 dark:border-red-600'
                    : option === currentQuestion.correctAnswer && selectedAnswer !== null
                      ? 'bg-green-100 border-green-500 dark:bg-green-800 dark:bg-opacity-30 dark:border-green-600'
                      : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  // Medium view (3x3) - More space for both question and answers
  const renderMediumView = () => {
    if (!quizActive) {
      return (
        <div className="h-full flex flex-col justify-center items-center text-center">
          {/* Use Globe icon from Lucide with consistent styling */}
          <Globe size={24} className="text-gray-400 mb-3" strokeWidth={1.5} />
          {/* Consistent text styling */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Test your knowledge of world geography!
          </p>
          {/* Consistent button styling */}
          <Button
            size="sm"
            onClick={startQuiz}
            variant="outline"
          >
            Start Quiz
          </Button>
        </div>
      );
    }

    if (quizCompleted) {
      return (
        <div className="h-full flex flex-col justify-center items-center text-center space-y-4">
          <h2 className="text-xl font-semibold">Quiz Completed!</h2>
          <div className="text-3xl font-bold">
            {score}/{currentQuestions.length}
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            {score === currentQuestions.length ? "Perfect score! You're a geography master!" : 
             score >= currentQuestions.length * 0.7 ? "Great job! You know your geography well!" :
             score >= currentQuestions.length * 0.5 ? "Good effort! Keep learning!" :
             "Better luck next time! Keep practicing your geography skills!"}
          </p>
          <button 
            onClick={startQuiz}
            className="mt-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            New Quiz
          </button>
        </div>
      );
    }
    
    const currentQuestion = currentQuestions[currentQuestionIndex];
    
    return (
      <div className="h-full flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Question {currentQuestionIndex + 1}/{currentQuestions.length}</span>
            <span className="text-sm font-medium">Score: {score}</span>
          </div>
          
          <div className="mb-4">
            <h3 className="text-base font-medium mb-2">{currentQuestion?.question}</h3>
            
            {currentQuestion?.image && (
              <div className="mb-3">
                <img 
                  src={currentQuestion.image} 
                  alt="Quiz" 
                  className="max-h-28 mx-auto object-contain border rounded-md" 
                />
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {currentQuestion?.options.map((option) => (
            <button
              key={option}
              onClick={() => handleAnswerSelect(option)}
              className={`py-3 px-4 text-sm font-medium rounded-lg border ${
                selectedAnswer === null 
                  ? 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700' 
                  : selectedAnswer === option
                    ? option === currentQuestion.correctAnswer
                      ? 'bg-green-100 border-green-500 dark:bg-green-800 dark:bg-opacity-30 dark:border-green-600'
                      : 'bg-red-100 border-red-500 dark:bg-red-800 dark:bg-opacity-30 dark:border-red-600'
                    : option === currentQuestion.correctAnswer && selectedAnswer !== null
                      ? 'bg-green-100 border-green-500 dark:bg-green-800 dark:bg-opacity-30 dark:border-green-600'
                      : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  // Wide Medium view (4x3) - More horizontal space
  const renderWideMediumView = () => {
    return renderMediumView(); // For simplicity, reuse the medium view
  };
  
  // Tall Medium view (3x4) - More vertical space
  const renderTallMediumView = () => {
    return renderMediumView(); // For simplicity, reuse the medium view
  };
  
  // Large view (4x4) - Full featured view
  const renderLargeView = () => {
    return renderMediumView(); // For simplicity, reuse the medium view
  };
  
  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  };
  
  // Settings dialog
  const renderSettings = () => {
    return (
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Geography Quiz Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Title setting */}
            <div className="space-y-2">
              <Label htmlFor="title-input">Widget Title</Label>
              <Input
                id="title-input"
                value={localConfig.title || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setLocalConfig({...localConfig, title: e.target.value})
                }
              />
            </div>
            
            {/* Difficulty setting */}
            <div className="space-y-2">
              <Label htmlFor="difficulty-select">Difficulty</Label>
              <Select
                value={localConfig.difficulty}
                onValueChange={(value: QuizDifficulty) => 
                  setLocalConfig({...localConfig, difficulty: value})
                }
              >
                <SelectTrigger id="difficulty-select">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={QuizDifficulty.EASY}>Easy</SelectItem>
                  <SelectItem value={QuizDifficulty.MEDIUM}>Medium</SelectItem>
                  <SelectItem value={QuizDifficulty.HARD}>Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Question type setting */}
            <div className="space-y-2">
              <Label htmlFor="question-type-select">Question Type</Label>
              <Select
                value={localConfig.questionType}
                onValueChange={(value: QuestionType) => 
                  setLocalConfig({...localConfig, questionType: value})
                }
              >
                <SelectTrigger id="question-type-select">
                  <SelectValue placeholder="Select question type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={QuestionType.MIXED}>Mixed</SelectItem>
                  <SelectItem value={QuestionType.CAPITALS}>Capitals</SelectItem>
                  <SelectItem value={QuestionType.FLAGS}>Flags</SelectItem>
                  <SelectItem value={QuestionType.BORDERS}>Borders</SelectItem>
                  <SelectItem value={QuestionType.LANDMARKS}>Landmarks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Questions per round setting */}
            <div className="space-y-2">
              <Label htmlFor="questions-per-round-input">Questions per Round</Label>
              <Input
                id="questions-per-round-input"
                type="number"
                min="1"
                max="20"
                value={localConfig.questionsPerRound || 5}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setLocalConfig({...localConfig, questionsPerRound: parseInt(e.target.value, 10)})
                }
              />
            </div>
          </div>
          
          <DialogFooter>
            <div className="flex justify-between w-full">
              {config?.onDelete && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (config.onDelete) {
                      config.onDelete();
                    }
                  }}
                  aria-label="Delete this widget"
                >
                  Delete
                </Button>
              )}
              <Button
                type="submit"
                onClick={saveSettings}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Main render
  return (
    <div ref={widgetRef} className="widget-container h-full flex flex-col relative">
      <WidgetHeader 
        title={localConfig.title || defaultConfig.title} 
        onSettingsClick={() => setShowSettings(true)}
      />
      
      <div className="flex-grow p-4 overflow-hidden">
        {renderContent()}
      </div>
      
      {renderSettings()}
    </div>
  );
};

export default GeographyQuizWidget; 