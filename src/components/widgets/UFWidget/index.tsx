import * as React from 'react';
import { useState, useEffect, useRef, useMemo, useCallback, useReducer } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Checkbox,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import { UFWidgetProps, UFWidgetConfig, UFData } from './types';

/**
 * Size categories for widget content rendering
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

// Define action types
type UFWidgetAction = 
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { data: UFData; timestamp: Date } }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'USE_FALLBACK'; payload: UFData }
  | { type: 'INCREMENT_RETRY' };

// Define state interface
interface UFWidgetState {
  loading: boolean;
  error: string | null;
  ufData: UFData | null;
  lastUpdated: Date | null;
  retryCount: number;
  useFallbackData: boolean;
}

// Initial state
const initialState: UFWidgetState = {
  loading: true,
  error: null,
  ufData: null,
  lastUpdated: null,
  retryCount: 0,
  useFallbackData: false
};

// Reducer function
function ufWidgetReducer(state: UFWidgetState, action: UFWidgetAction): UFWidgetState {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        loading: true,
        error: null,
        useFallbackData: false
      };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        error: null,
        ufData: action.payload.data,
        lastUpdated: action.payload.timestamp,
        retryCount: 0
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload
      };
    case 'USE_FALLBACK':
      return {
        ...state,
        loading: false,
        error: null,
        ufData: action.payload,
        lastUpdated: new Date(),
        useFallbackData: true
      };
    case 'INCREMENT_RETRY':
      return {
        ...state,
        retryCount: state.retryCount + 1
      };
    default:
      return state;
  }
}

/**
 * UF Widget Component
 * 
 * This widget displays the value of UF (Unidad de Fomento) in Chilean Pesos
 * using data from mindicador.cl API.
 * 
 * @param {UFWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const UFWidget: React.FC<UFWidgetProps> = ({ width, height, config }) => {
  // Default configuration
  const defaultConfig: UFWidgetConfig = {
    title: 'UF (Chile)',
    showHistory: false,
    refreshInterval: 60 // minutes
  };

  // Use reducer for complex state management
  const [state, dispatch] = useReducer(ufWidgetReducer, initialState);
  const { loading, error, ufData, lastUpdated, retryCount, useFallbackData } = state;

  // Component state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<UFWidgetConfig>({
    ...defaultConfig,
    ...config
  });

  // Refs
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Constants
  const maxRetries = 3;

  // Wrap fallbackUfData in useMemo
  const fallbackUfData = useMemo<UFData>(() => ({
    codigo: 'uf',
    nombre: 'Unidad de Fomento (UF)',
    unidad_medida: 'Pesos',
    fecha: new Date().toISOString().split('T')[0],
    valor: 38437.12,
    serie: [
      {
        fecha: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        valor: 38420.05
      },
      {
        fecha: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        valor: 38390.72
      },
      {
        fecha: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
        valor: 38368.23
      }
    ]
  }), []);

  // Fetch data with improved error handling and performance
  const fetchUfData = useCallback(async () => {
    let controller: AbortController | null = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      dispatch({ type: 'FETCH_START' });

      const response = await fetch('/api/mindicador/api', {
        method: 'GET',
        signal: controller?.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      // Check if the request was aborted or the controller is no longer valid
      if (!controller || controller !== abortControllerRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check again if the request was aborted or the controller is no longer valid
      if (!controller || controller !== abortControllerRef.current) {
        return;
      }

      if (!data || !data.uf) {
        throw new Error('Invalid API response format');
      }

      const transformedData: UFData = {
        codigo: data.uf.codigo,
        nombre: data.uf.nombre,
        unidad_medida: data.uf.unidad_medida,
        fecha: data.uf.fecha,
        valor: data.uf.valor,
        serie: data.uf.serie || []
      };

      dispatch({ 
        type: 'FETCH_SUCCESS', 
        payload: { 
          data: transformedData, 
          timestamp: new Date() 
        } 
      });
    } catch (err) {
      // Only handle errors if the controller is still valid
      if (controller === abortControllerRef.current) {
        if (err instanceof Error) {
          console.error('Error fetching UF data:', err);
          
          if (err.name === 'AbortError') {
            return; // Ignore abort errors
          }
          
          if (retryCount < maxRetries) {
            dispatch({ type: 'INCREMENT_RETRY' });
            const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            setTimeout(() => {
              if (controller === abortControllerRef.current) {
                fetchUfData();
              }
            }, backoffDelay);
          } else {
            dispatch({ type: 'FETCH_ERROR', payload: 'No se pudo obtener datos actualizados' });
            dispatch({ type: 'USE_FALLBACK', payload: fallbackUfData });
          }
        }
      }
    } finally {
      // Clear the controller reference if it hasn't been changed
      if (controller === abortControllerRef.current) {
        controller = null;
      }
    }
    // fallbackUfData is intentionally excluded from deps as it's a static memoized constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount, maxRetries]);

  // Update local config when props config changes
  useEffect(() => {
    setLocalConfig((prevConfig: UFWidgetConfig) => ({
      ...prevConfig,
      ...config
    }));
  }, [config]);

  // Format the UF value with proper thousands separator and 2 decimal places
  const formatUfValue = useCallback((value: number | undefined | null): string => {
    if (value === undefined || value === null) {
      return '--';
    }
    return value.toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, []); // Empty dependency array as this function doesn't depend on any props or state

  // Format date to DD/MM/YYYY
  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL');
  }, []); // Empty dependency array as this function doesn't depend on any props or state

  // Data fetching and refresh timer effect
  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchData = async () => {
      if (isActive) {
        await fetchUfData();
      }
    };

    // Initial fetch
    fetchData();

    // Setup refresh timer
    const refreshIntervalMinutes = localConfig.refreshInterval ?? defaultConfig.refreshInterval ?? 60;
    const refreshIntervalMs = refreshIntervalMinutes * 60 * 1000;
    
    const timerId = setInterval(() => {
      if (isActive) {
        fetchData();
      }
    }, refreshIntervalMs);
    
    refreshTimerRef.current = timerId;

    // Cleanup function
    return () => {
      isActive = false;
      if (controller === abortControllerRef.current) {
        controller.abort();
        abortControllerRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [localConfig.refreshInterval, fetchUfData, defaultConfig.refreshInterval]);
  
  /**
   * Determines the appropriate size category based on width and height
   */
  const getWidgetSizeCategory = useCallback((width: number, height: number): WidgetSizeCategory => {
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
  }, []);

  // Render error view with retry button and fallback option
  const renderErrorView = useCallback(() => {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-red-500 text-sm mb-2">Error al cargar datos</div>
        <div className="text-xs text-gray-500 mb-3">
          {error}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchUfData()}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Reintentar cargar datos"
            title="Reintentar"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => {
              setLocalConfig({...localConfig, useFallbackData: true, ufData: fallbackUfData});
            }}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Usar datos aproximados"
          >
            Usar aprox.
          </button>
        </div>
      </div>
    );
  }, [error, fetchUfData, localConfig, fallbackUfData]);

  // Memoize the size category calculation
  const sizeCategory = useMemo(() => getWidgetSizeCategory(width, height), [width, height, getWidgetSizeCategory]);

  // Memoize the view components with proper dependencies
  const smallView = useMemo(() => {
    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="animate-pulse">Cargando...</div>
        </div>
      );
    }
    
    if (error) {
      return renderErrorView();
    }
    
    if (!ufData || typeof ufData.valor === 'undefined') {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-gray-500 text-sm">No hay datos disponibles</div>
        </div>
      );
    }
    
    return (
      <div className="h-full flex flex-col justify-center items-center">
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          ${formatUfValue(ufData.valor)}
        </div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
          {formatDate(ufData.fecha)}
          {lastUpdated && ` · ${lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
        </div>
        {useFallbackData && (
          <div className="text-[10px] text-amber-500 dark:text-amber-400 mt-0.5">
            (Valor aproximado)
          </div>
        )}
        <button
          onClick={() => fetchUfData()}
          className="mt-2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          title="Actualizar"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    );
  }, [loading, error, ufData, useFallbackData, formatUfValue, formatDate, lastUpdated, renderErrorView, fetchUfData]);
  
  // Render wide small view (3x2 or 4x2)
  const renderWideSmallView = useCallback(() => {
    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="animate-pulse">Cargando...</div>
        </div>
      );
    }
    
    if (error) {
      return renderErrorView();
    }
    
    if (!ufData || typeof ufData.valor === 'undefined') {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-gray-500 text-sm">No hay datos disponibles</div>
        </div>
      );
    }
    
    return (
      <div className="h-full flex justify-between items-center">
        <div className="flex flex-col">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
            UF Chile
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ${formatUfValue(ufData.valor)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(ufData.fecha)}
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <button
            onClick={() => fetchUfData()}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={16} />
          </button>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {lastUpdated && lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  }, [loading, error, ufData, formatUfValue, formatDate, fetchUfData, lastUpdated]);

  // Render tall small view (2x3 or 2x4)
  const renderTallSmallView = useCallback(() => {
    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="animate-pulse">Cargando...</div>
        </div>
      );
    }
    
    if (error) {
      return renderErrorView();
    }
    
    if (!ufData || typeof ufData.valor === 'undefined') {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-gray-500 text-sm">No hay datos disponibles</div>
        </div>
      );
    }
    
    return (
      <div className="h-full flex flex-col justify-between">
        <div className="flex flex-col items-center">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
            UF Chile
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            ${formatUfValue(ufData.valor)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(ufData.fecha)}
          </div>
        </div>
        
        <div className="flex flex-col items-center">
          <button
            onClick={() => fetchUfData()}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={16} />
          </button>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
            {lastUpdated && lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  }, [loading, error, ufData, formatUfValue, formatDate, fetchUfData, lastUpdated]);

  // Render medium view (3x3)
  const renderMediumView = useCallback(() => {
    if (loading || error || !ufData) {
      return smallView;
    }
    
    const showHistoricalData = localConfig.showHistory && ufData.serie && ufData.serie.length > 0;
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Unidad de Fomento (UF)
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              ${formatUfValue(ufData.valor)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(ufData.fecha)}
            </div>
          </div>

          <button
            onClick={() => fetchUfData()}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        
        {showHistoricalData && (
          <div className="flex-grow overflow-y-auto">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Historial reciente
            </div>
            <div className="space-y-1">
              {ufData.serie.slice(0, 5).map((item, index) => (
                <div key={index} className="flex justify-between text-xs px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                  <span>{formatDate(item.fecha)}</span>
                  <span className="font-medium">${formatUfValue(item.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {lastUpdated && `Última actualización: ${lastUpdated.toLocaleTimeString()}`}
        </div>
      </div>
    );
  }, [loading, error, ufData, localConfig.showHistory, formatUfValue, formatDate, fetchUfData, lastUpdated]);
  
  // Render wide medium view (4x3)
  const renderWideMediumView = useCallback(() => {
    if (loading || error || !ufData) {
      return renderMediumView();
    }
    
    const showHistoricalData = localConfig.showHistory && ufData.serie && ufData.serie.length > 0;
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Unidad de Fomento (UF) - Chile
            </div>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              ${formatUfValue(ufData.valor)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Valor al {formatDate(ufData.fecha)}
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            <button
              onClick={() => fetchUfData()}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="Actualizar"
            >
              <RefreshCw size={16} />
            </button>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {lastUpdated && lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {showHistoricalData && (
          <div className="flex-grow overflow-y-auto">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Historial de valores
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ufData.serie.slice(0, 10).map((item, index) => (
                <div key={index} className="flex justify-between text-xs px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                  <span>{formatDate(item.fecha)}</span>
                  <span className="font-medium">${formatUfValue(item.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Fuente: mindicador.cl
        </div>
      </div>
    );
  }, [loading, error, ufData, localConfig.showHistory, formatUfValue, formatDate, fetchUfData, lastUpdated]);

  // Render tall medium view (3x4)
  const renderTallMediumView = useCallback(() => {
    if (loading || error || !ufData) {
      return renderMediumView();
    }
    
    const showHistoricalData = localConfig.showHistory && ufData.serie && ufData.serie.length > 0;
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Unidad de Fomento (UF)
            </div>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              ${formatUfValue(ufData.valor)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(ufData.fecha)}
            </div>
          </div>
          
          <button
            onClick={() => fetchUfData()}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {showHistoricalData && (
          <div className="flex-grow overflow-y-auto">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Historial de valores
            </div>
            <div className="space-y-1">
              {ufData.serie.slice(0, 15).map((item, index) => (
                <div key={index} className="flex justify-between text-xs px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                  <span>{formatDate(item.fecha)}</span>
                  <span className="font-medium">${formatUfValue(item.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {lastUpdated && lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          <div>Fuente: mindicador.cl</div>
        </div>
      </div>
    );
  }, [loading, error, ufData, localConfig.showHistory, formatUfValue, formatDate, fetchUfData, lastUpdated]);

  // Render large view (4x4 or larger)
  const renderLargeView = useCallback(() => {
    if (loading || error || !ufData) {
      return renderMediumView();
    }
    
    const showHistoricalData = localConfig.showHistory && ufData.serie && ufData.serie.length > 0;
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Unidad de Fomento (UF) - Chile
            </div>
            <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">
              ${formatUfValue(ufData.valor)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Valor al {formatDate(ufData.fecha)}
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            <button
              onClick={() => fetchUfData()}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="Actualizar"
            >
              <RefreshCw size={18} />
            </button>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {lastUpdated && lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {showHistoricalData && (
          <div className="flex-grow overflow-y-auto">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              Historial de valores
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {ufData.serie.slice(0, 20).map((item, index) => (
                <div key={index} className="flex justify-between text-sm px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <span>{formatDate(item.fecha)}</span>
                  <span className="font-medium">${formatUfValue(item.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Fuente: mindicador.cl
        </div>
      </div>
    );
  }, [loading, error, ufData, localConfig.showHistory, formatUfValue, formatDate, fetchUfData, lastUpdated]);
  
  // Memoize the content selection based on size category
  const content = useMemo(() => {
    switch (sizeCategory) {
      case WidgetSizeCategory.SMALL:
        return smallView;
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
        return smallView;
    }
  }, [
    sizeCategory,
    smallView,
    renderWideSmallView,
    renderTallSmallView,
    renderMediumView,
    renderWideMediumView,
    renderTallMediumView,
    renderLargeView
  ]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  // Main render with memoized header
  const header = useMemo(() => (
    <WidgetHeader 
      title={localConfig.title || defaultConfig.title} 
      onSettingsClick={() => setShowSettings(true)}
    />
  ), [localConfig.title, defaultConfig.title]);

  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
      
      // Re-fetch data if refresh interval has changed
      const configRefreshInterval = config.refreshInterval !== undefined 
        ? config.refreshInterval 
        : defaultConfig.refreshInterval || 60;
        
      if (localConfig.refreshInterval !== configRefreshInterval) {
        // Clear any existing timer
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
        }
        
        // Set up new timer with fallback default
        const refreshIntervalMinutes = localConfig.refreshInterval !== undefined 
          ? localConfig.refreshInterval 
          : defaultConfig.refreshInterval || 60;
        
        const refreshIntervalMs = refreshIntervalMinutes * 60 * 1000;
        
        // Set up new timer and store the ID
        const timerId = setInterval(fetchUfData, refreshIntervalMs);
        refreshTimerRef.current = timerId;
      }
    }
    setShowSettings(false);
  };
  
  // Settings dialog
  const renderSettings = () => {
    return (
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>UF Widget Settings</DialogTitle>
          </DialogHeader>
          
          {/* Change py-2 to py-4 */}
          <div className="space-y-4 py-4">
            {/* Title setting */}
            <div className="space-y-1.5">
              {/* Replace native label with shadcn/ui Label */}
              <Label htmlFor="title-input" className="text-sm font-medium">
                Widget Title
              </Label>
              {/* Replace native input with shadcn/ui Input */}
              <Input
                id="title-input"
                type="text"
                value={localConfig.title || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setLocalConfig({...localConfig, title: e.target.value})
                }
                className="w-full" // Use shadcn/ui Input styling
              />
            </div>

            {/* Show history toggle */}
            <div className="flex items-center space-x-2">
              {/* Replace native checkbox with shadcn/ui Checkbox */}
              <Checkbox
                id="history-toggle"
                checked={localConfig.showHistory || false}
                onCheckedChange={(checked: boolean | 'indeterminate') => // Updated type for onCheckedChange
                  setLocalConfig({...localConfig, showHistory: !!checked}) // Ensure boolean value
                }
              />
              {/* Replace native label with shadcn/ui Label */}
              <Label htmlFor="history-toggle" className="text-sm font-medium">
                Show Historical Data
              </Label>
            </div>

            {/* Refresh interval setting */}
            <div className="space-y-1.5">
              {/* Replace native label with shadcn/ui Label */}
              <Label htmlFor="refresh-input" className="text-sm font-medium">
                Refresh Interval (minutes)
              </Label>
              {/* Replace native input with shadcn/ui Input */}
              <Input
                id="refresh-input"
                type="number"
                min="1"
                max="1440"
                value={localConfig.refreshInterval || defaultConfig.refreshInterval}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setLocalConfig({...localConfig, refreshInterval: parseInt(e.target.value) || defaultConfig.refreshInterval})
                }
                className="w-full" // Use shadcn/ui Input styling
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
                type="button"
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
      {header}
      <div className="flex-grow p-4 overflow-hidden">
        {content}
      </div>
      {renderSettings()}
    </div>
  );
};

export default React.memo(UFWidget); 