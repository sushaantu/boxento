import React, { useEffect, useRef, useState } from 'react';

import DashboardWidgetFrame from '@/components/dashboard/DashboardWidgetFrame';

type DeferredDashboardWidgetFrameProps = React.ComponentProps<typeof DashboardWidgetFrame> & {
  defer?: boolean;
  rootMargin?: string;
};

type DeferredFrameObserver = {
  callbacks: Map<Element, () => void>;
  observer: IntersectionObserver;
  refCount: number;
};

const deferredFrameObservers = new Map<string, DeferredFrameObserver>();

const observeDeferredFrame = (
  element: Element,
  rootMargin: string,
  onIntersect: () => void
) => {
  let sharedObserver = deferredFrameObservers.get(rootMargin);

  if (!sharedObserver) {
    const callbacks = new Map<Element, () => void>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const callback = callbacks.get(entry.target);
        if (!callback) {
          return;
        }

        callbacks.delete(entry.target);
        observer.unobserve(entry.target);
        callback();
      });
    }, {
      root: null,
      rootMargin,
      threshold: 0,
    });

    sharedObserver = { callbacks, observer, refCount: 0 };
    deferredFrameObservers.set(rootMargin, sharedObserver);
  }

  sharedObserver.refCount += 1;
  sharedObserver.callbacks.set(element, onIntersect);
  sharedObserver.observer.observe(element);

  let disposed = false;

  return () => {
    if (disposed) {
      return;
    }

    disposed = true;
    sharedObserver.callbacks.delete(element);
    sharedObserver.observer.unobserve(element);
    sharedObserver.refCount -= 1;

    if (sharedObserver.refCount === 0) {
      sharedObserver.observer.disconnect();
      deferredFrameObservers.delete(rootMargin);
    }
  };
};

export function DeferredDashboardWidgetFrame({
  defer = true,
  rootMargin = '900px 0px',
  ...props
}: DeferredDashboardWidgetFrameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldMount, setShouldMount] = useState(!defer);

  useEffect(() => {
    if (!defer || shouldMount) {
      return;
    }

    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShouldMount(true);
      return;
    }

    return observeDeferredFrame(element, rootMargin, () => {
      setShouldMount(true);
    });
  }, [defer, rootMargin, shouldMount]);

  return (
    <div ref={containerRef} className="h-full">
      {shouldMount ? (
        <DashboardWidgetFrame {...props} />
      ) : (
        <div
          aria-hidden="true"
          className="h-full w-full rounded-lg bg-card/60"
          data-deferred-widget-placeholder
        />
      )}
    </div>
  );
}

export default DeferredDashboardWidgetFrame;
