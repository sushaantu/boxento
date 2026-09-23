import { DirectoryBadges } from '@/components/DirectoryBadges';

declare const __BUILD_HASH__: string;
declare const __BUILD_TIME__: number;

export const AppFooter = () => {
  const currentYear = new Date().getFullYear();
  const buildHash = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev';
  const buildTime = typeof __BUILD_TIME__ !== 'undefined'
    ? new Date(__BUILD_TIME__).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  return (
    <footer className="py-4 sm:py-6 px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-12 my-4 sm:my-8 border-t border-gray-200 dark:border-gray-800">
      <div className="w-full flex flex-col gap-4 sm:gap-6">
        {/* Mobile layout (stacked) */}
        <div className="flex flex-col items-center gap-3 sm:hidden">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Built by{' '}
            <a
              href="https://sushaantu.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Sushaantu
            </a>
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <a
              href="https://github.com/sushaantu/boxento"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="sr-only sm:not-sr-only">View Source</span>
            </a>
            <a
              href="https://twitter.com/intent/tweet?text=Check%20out%20Boxento%20-%20An%20awesome%20open-source%20dashboard%20built%20by%20%40su%20%F0%9F%9A%80&url=https%3A%2F%2Fgithub.com%2Fsushaantu%2Fboxento"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
              <span className="sr-only sm:not-sr-only">Share Project</span>
            </a>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <a
              href="https://github.com/sushaantu/boxento/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Report Issue
            </a>
            <a
              href="https://github.com/sushaantu/boxento#contributing"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Contribute
            </a>
          </div>
          <div className="text-sm text-gray-400 dark:text-gray-500 flex items-center gap-2">
            <span>© {currentYear}</span>
            <span>·</span>
            <a
              href={`https://github.com/sushaantu/boxento/commit/${buildHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title={buildTime ? `Built: ${buildTime}` : undefined}
            >
              v{buildHash}
            </a>
          </div>
        </div>

        {/* Desktop/Tablet layout (side by side) */}
        <div className="hidden sm:flex sm:flex-row justify-between items-center">
          <div className="flex items-center gap-4 md:gap-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Built by{' '}
              <a
                href="https://sushaantu.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Sushaantu
              </a>
            </p>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <a
                href="https://github.com/sushaantu/boxento"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                View Source
              </a>
              <a
                href="https://twitter.com/intent/tweet?text=Check%20out%20Boxento%20-%20An%20awesome%20open-source%20dashboard%20built%20by%20%40su%20%F0%9F%9A%80&url=https%3A%2F%2Fgithub.com%2Fsushaantu%2Fboxento"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                Share Project
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-4 md:gap-6 text-sm text-gray-500 dark:text-gray-400">
              <a
                href="https://github.com/sushaantu/boxento/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Report Issue
              </a>
              <a
                href="https://github.com/sushaantu/boxento#contributing"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Contribute
              </a>
            </div>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <div className="text-sm text-gray-400 dark:text-gray-500 flex items-center gap-2">
              <span>© {currentYear}</span>
              <span>·</span>
              <a
                href={`https://github.com/sushaantu/boxento/commit/${buildHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title={buildTime ? `Built: ${buildTime}` : undefined}
              >
                v{buildHash}
              </a>
            </div>
          </div>
        </div>

        <DirectoryBadges />
      </div>
    </footer>
  );
};

export default AppFooter;
