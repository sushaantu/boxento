import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Button,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@boxento/primitives';
import {
  Check,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react';
import WidgetHeader from '../common/WidgetHeader';
import { TodoWidgetProps, TodoWidgetConfig, TodoItem } from './types';

/**
 * Todo Widget Component
 * 
 * A widget for managing a todo list
 * 
 * @param {TodoWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const TodoWidget: React.FC<TodoWidgetProps> = ({ width, height, config }) => {
  const defaultConfig: TodoWidgetConfig = {
    title: 'Todo List',
    items: [],
    backgroundColor: '#FFFFFF',
    showCompletedItems: true,
    sortOrder: 'created'
  };

  const [localConfig, setLocalConfig] = useState<TodoWidgetConfig>({
    ...defaultConfig,
    ...config
  });

  const [showSettings, setShowSettings] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');
  const [draggedItem, setDraggedItem] = useState<TodoItem | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dragDirection, setDragDirection] = useState<'up' | 'down' | null>(null);
  const newTodoInputRef = useRef<HTMLInputElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  
  // Determine layout based on width and height
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;

  // Update local config when props change
  useEffect(() => {
    setLocalConfig(prevConfig => ({
      ...prevConfig,
      ...config
    }));
  }, [config]);

  const addTodo = () => {
    if (!newTodoText.trim()) return;
    
    // Get current items and determine the highest sort order
    const currentItems = localConfig.items || [];
    const maxSortOrder = currentItems.length > 0 
      ? Math.max(...currentItems.map(item => item.sortOrder || 0)) 
      : -1;
    
    // Generate a unique ID using timestamp and random number for broader compatibility
    const newTodoId = 'todo-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

    const newTodo: TodoItem = {
      id: newTodoId,
      text: newTodoText.trim(),
      completed: false,
      createdAt: new Date(),
      sortOrder: maxSortOrder + 1
    };

    const updatedItems = [...currentItems, newTodo];
    
    setLocalConfig(prev => ({
      ...prev,
      items: updatedItems
    }));
    
    // Save to parent config
    if (config?.onUpdate) {
      config.onUpdate({
        ...localConfig,
        items: updatedItems
      });
    }
    
    setNewTodoText('');
  };

  const toggleTodo = (id: string) => {
    const updatedItems = (localConfig.items || []).map(item => {
      if (item.id === id) {
        return { ...item, completed: !item.completed };
      }
      return item;
    });
    
    setLocalConfig(prev => ({
      ...prev,
      items: updatedItems
    }));
    
    // Save to parent config
    if (config?.onUpdate) {
      config.onUpdate({
        ...localConfig,
        items: updatedItems
      });
    }
  };

  const deleteTodo = (id: string) => {
    const updatedItems = (localConfig.items || []).filter(item => item.id !== id);
    
    setLocalConfig(prev => ({
      ...prev,
      items: updatedItems
    }));
    
    // Save to parent config
    if (config?.onUpdate) {
      config.onUpdate({
        ...localConfig,
        items: updatedItems
      });
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setLocalConfig(prev => ({
      ...prev,
      title: newTitle
    }));
  };

  const handleShowCompletedChange = (checked: boolean) => {
    setLocalConfig(prev => ({
      ...prev,
      showCompletedItems: checked
    }));
  };

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, item: TodoItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    // Add some transparency to the dragged item
    if (e.currentTarget) {
      setTimeout(() => {
        e.currentTarget.style.opacity = '0.5';
      }, 0);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    setDraggedItem(null);
    setDragOverItemId(null);
    setDragDirection(null);
    e.currentTarget.style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>, overItem: TodoItem) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === overItem.id) {
      setDragOverItemId(null);
      return false;
    }
    
    e.dataTransfer.dropEffect = 'move';
    
    // Get mouse position relative to the item
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const threshold = rect.height / 2;
    
    // Set direction based on mouse position and item position
    if (mouseY < threshold) {
      setDragDirection('up'); // Drop above the item
    } else {
      setDragDirection('down'); // Drop below the item
    }
    
    setDragOverItemId(overItem.id);
    
    return false;
  };

  const handleDrop = (e: React.DragEvent<HTMLLIElement>, targetItem: TodoItem) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === targetItem.id) return;
    
    // Get current items
    const items = [...(localConfig.items || [])];
    
    // Find indices
    const draggedIndex = items.findIndex(item => item.id === draggedItem.id);
    const targetIndex = items.findIndex(item => item.id === targetItem.id);
    
    if (draggedIndex < 0 || targetIndex < 0) return;
    
    // Remove the dragged item
    const [removed] = items.splice(draggedIndex, 1);
    
    // Calculate the new index based on direction
    let newIndex = targetIndex;
    
    // If we're dragging down and the dragged item is before the target, 
    // we need to adjust the target index
    if (dragDirection === 'down' && draggedIndex < targetIndex) {
      newIndex = targetIndex - 1;
    }
    
    // If we're dragging up and the dragged item is after the target,
    // we don't need to adjust
    if (dragDirection === 'up' && draggedIndex > targetIndex) {
      newIndex = targetIndex;
    }
    
    // If we're dragging up and the dragged item is before the target,
    // we need to insert after the target
    if (dragDirection === 'up' && draggedIndex < targetIndex) {
      newIndex = targetIndex - 1;
    }
    
    // If we're dragging down and the dragged item is after the target,
    // we need to insert after the target
    if (dragDirection === 'down' && draggedIndex > targetIndex) {
      newIndex = targetIndex + 1;
    }
    
    // Insert at new position
    items.splice(newIndex, 0, removed);
    
    // Update sort orders
    const updatedItems = items.map((item, index) => ({
      ...item,
      sortOrder: index
    }));
    
    // Reset drag state
    setDragOverItemId(null);
    setDragDirection(null);
    
    // Update to manual sort order if not already set
    const updatedConfig = {
      ...localConfig,
      items: updatedItems,
      sortOrder: 'manual' as const
    };
    
    // Update local state
    setLocalConfig(updatedConfig);
    
    // Update parent state
    if (config?.onUpdate) {
      config.onUpdate(updatedConfig);
    }
  };

  const getDropZoneClass = (itemId: string) => {
    if (draggedItem && dragOverItemId === itemId) {
      if (dragDirection === 'up') {
        return 'border-t-2 border-blue-500';
      } else if (dragDirection === 'down') {
        return 'border-b-2 border-blue-500';
      }
    }
    return '';
  };

  const handleSortOrderChange = (value: 'created' | 'alphabetical' | 'completed' | 'manual') => {
    setLocalConfig(prev => ({
      ...prev,
      sortOrder: value
    }));
  };

  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  };

  const getFilteredAndSortedItems = () => {
    let items = [...(localConfig.items || [])];
    
    // Filter out completed items if needed
    if (!localConfig.showCompletedItems) {
      items = items.filter(item => !item.completed);
    }
    
    // Sort items
    switch (localConfig.sortOrder) {
      case 'alphabetical':
        items.sort((a, b) => a.text.localeCompare(b.text));
        break;
      case 'completed':
        items.sort((a, b) => {
          if (a.completed === b.completed) {
            return 0;
          }
          return a.completed ? 1 : -1;
        });
        break;
      case 'manual':
        items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        break;
      case 'created':
      default:
        items.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateA.getTime() - dateB.getTime();
        });
        break;
    }
    
    return items;
  };

  const renderTodoList = (items: TodoItem[]) => (
    <div className="space-y-2 pr-1">
      {items.map(item => (
        <li 
          key={item.id} 
          draggable
          onDragStart={(e) => handleDragStart(e, item)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, item)}
          onDrop={(e) => handleDrop(e, item)}
          className={`flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 dark:hover:bg-opacity-50 rounded-lg transition-all relative text-gray-800 dark:text-gray-100 group cursor-grab active:cursor-grabbing ${getDropZoneClass(item.id)}`}
        >
          <div className="flex-shrink-0 mr-0.5 text-gray-300 dark:text-gray-700 group-hover:text-gray-400 dark:group-hover:text-gray-600 transition-colors">
            <GripVertical size={14} />
          </div>
          
          <button
            onClick={() => toggleTodo(item.id)}
            className={`flex-shrink-0 w-5 h-5 rounded-full border ${
              item.completed 
                ? 'bg-green-500 border-green-500 text-white' 
                : 'border-gray-300 dark:border-gray-600'
            } flex items-center justify-center`}
            aria-label={item.completed ? "Mark as incomplete" : "Mark as complete"}
          >
            {item.completed && <Check size={12} />}
          </button>
          
          <span 
            className={`flex-grow truncate ${
              item.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''
            }`}
          >
            {item.text}
          </span>
          
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => deleteTodo(item.id)}
              className="p-1 text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
              aria-label="Delete task"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </li>
      ))}
    </div>
  );

  const renderAddTodoForm = () => (
    <form 
      onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (newTodoText.trim()) {
          addTodo();
        }
      }}
      className="flex items-center gap-2"
    >
      <Input
        ref={newTodoInputRef}
        type="text"
        value={newTodoText}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTodoText(e.target.value)}
        placeholder="Add task..."
        className="flex-grow"
        aria-label="New task"
      />
      <button
        type="submit"
        disabled={!newTodoText.trim()}
        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
        aria-label="Add task"
      >
        <Plus size={20} />
      </button>
    </form>
  );

  const renderDefaultView = () => {
    const items = getFilteredAndSortedItems();
    return (
      <div className="h-full flex flex-col">
        <div className="flex-grow overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <p>No tasks</p>
            </div>
          ) : (
            renderTodoList(items)
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          {renderAddTodoForm()}
        </div>
      </div>
    );
  };

  const renderCompactView = () => {
    const items = getFilteredAndSortedItems();
    return (
      <div className="h-full flex flex-col">
        <div className="flex-grow overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-xs text-gray-500 dark:text-gray-400">
              <p>No tasks</p>
            </div>
          ) : (
            <div className="space-y-1 pr-1">
              {items.map(item => (
                <li 
                  key={item.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, item)}
                  onDrop={(e) => handleDrop(e, item)}
                  className={`flex items-center p-1 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 dark:hover:bg-opacity-50 transition-all relative text-gray-800 dark:text-gray-100 group cursor-grab active:cursor-grabbing ${getDropZoneClass(item.id)}`}
                >
                  <div className="flex-shrink-0 mr-0.5 text-gray-300 dark:text-gray-700 group-hover:text-gray-400 dark:group-hover:text-gray-600 transition-colors">
                    <GripVertical size={10} />
                  </div>
                  <button
                    onClick={() => toggleTodo(item.id)}
                    className={`flex-shrink-0 w-3 h-3 rounded-full border ${
                      item.completed 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : 'border-gray-300 dark:border-gray-600'
                    } flex items-center justify-center mr-1.5`}
                    aria-label={item.completed ? "Mark as incomplete" : "Mark as complete"}
                  >
                    {item.completed && <Check size={8} />}
                  </button>
                  <span className={`text-xs font-medium flex-grow truncate ${
                    item.completed ? 'line-through text-gray-400' : ''
                  }`}>
                    {item.text}
                  </span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                    <button
                      onClick={() => deleteTodo(item.id)}
                      className="p-0.5 text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                      aria-label="Delete task"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </li>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <form 
            onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              if (newTodoText.trim()) {
                addTodo();
              }
            }}
            className="flex items-center gap-2"
          >
            <Input
              ref={newTodoInputRef}
              type="text"
              value={newTodoText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTodoText(e.target.value)}
              placeholder="Add task..."
              className="flex-grow text-xs"
            />
            <button
              type="submit"
              disabled={!newTodoText.trim()}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            >
              <Plus size={14} />
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderWideView = () => {
    const items = getFilteredAndSortedItems();
    return (
      <div className="h-full grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <h3 className="text-sm font-medium mb-2">Tasks</h3>
          <div className="flex-grow overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <p>No tasks</p>
              </div>
            ) : (
              renderTodoList(items)
            )}
          </div>
        </div>
        <div className="flex flex-col">
          {renderAddTodoForm()}
        </div>
      </div>
    );
  };

  const renderTallView = () => {
    const items = getFilteredAndSortedItems();
    return (
      <div className="h-full flex flex-col">
        <div className="flex-grow overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <p>No tasks</p>
            </div>
          ) : (
            renderTodoList(items)
          )}
        </div>
        <div className="mt-4">
          {renderAddTodoForm()}
        </div>
      </div>
    );
  };

  const renderLargeView = () => {
    const items = getFilteredAndSortedItems();
    const completedItems = items.filter(item => item.completed);
    const pendingItems = items.filter(item => !item.completed);

    return (
      <div className="h-full grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <h3 className="text-sm font-medium mb-2">Pending Tasks ({pendingItems.length})</h3>
          <div className="flex-grow overflow-y-auto">
            {pendingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <p>No pending tasks</p>
              </div>
            ) : (
              renderTodoList(pendingItems)
            )}
          </div>
          <div className="mt-4">
            {renderAddTodoForm()}
          </div>
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-medium mb-2">Completed Tasks ({completedItems.length})</h3>
          <div className="flex-grow overflow-y-auto">
            {completedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <p>No completed tasks</p>
              </div>
            ) : (
              renderTodoList(completedItems)
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render todo items with integrated add form
  const renderContent = () => {
    if (isCompact) {
      return renderCompactView();
    } else if (isWide && isTall) {
      return renderLargeView();
    } else if (isWide) {
      return renderWideView();
    } else if (isTall) {
      return renderTallView();
    } else {
      return renderDefaultView();
    }
  };

  // Settings modal using shadcn/ui Dialog
  const renderSettings = () => {
    return (
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>To Do Settings</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Widget Title</Label>
              <Input
                id="title"
                placeholder="Todo List"
                value={localConfig.title || ''}
                onChange={handleTitleChange}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="showCompleted">Show Completed Items</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="showCompleted"
                  checked={!!localConfig.showCompletedItems}
                  onCheckedChange={handleShowCompletedChange}
                />
                <Label htmlFor="showCompleted" className="text-sm text-gray-500">
                  {localConfig.showCompletedItems ? 'On' : 'Off'}
                </Label>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Select
                value={localConfig.sortOrder || 'created'}
                onValueChange={(value: 'created' | 'alphabetical' | 'completed' | 'manual') => handleSortOrderChange(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sort order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Created Date</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  <SelectItem value="completed">Completion Status</SelectItem>
                  <SelectItem value="manual">Manual (Drag to Sort)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            {/* Remove pt-6 border-t border-gray-100 dark:border-gray-800 classes */}
            <div className="flex justify-between w-full">
              {config?.onDelete && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (config.onDelete) {
                      config.onDelete();
                    }
                  }}
                >
                  Delete
                </Button>
              )}
              
              <Button
                variant="default"
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

  return (
    <div 
      ref={widgetRef} 
      className="widget-container h-full flex flex-col"
    >
      <WidgetHeader 
        title={localConfig.title || defaultConfig.title} 
        onSettingsClick={() => setShowSettings(true)}
      />
      
      <div className="flex-1 overflow-hidden p-3">
        {renderContent()}
      </div>
      
      {renderSettings()}
    </div>
  );
};

export default TodoWidget; 