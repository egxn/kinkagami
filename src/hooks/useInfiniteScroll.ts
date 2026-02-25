import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseInfiniteScrollResult<T> {
  displayedItems: T[];
  sentinelRef: RefObject<HTMLDivElement | null>;
  loadingMore: boolean;
  hasMore: boolean;
}

export function useInfiniteScroll<T>(
  items: T[],
  pageSize: number,
): UseInfiniteScrollResult<T> {
  const [displayedItems, setDisplayedItems] = useState<T[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset list when items change
  useEffect(() => {
    setDisplayedItems(items.slice(0, pageSize));
    setHasMore(items.length > pageSize);
  }, [items, pageSize]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    const currentLength = displayedItems.length;
    const nextBatch = items.slice(currentLength, currentLength + pageSize);

    if (nextBatch.length > 0) {
      setDisplayedItems((prev) => [...prev, ...nextBatch]);
      setHasMore(currentLength + nextBatch.length < items.length);
    } else {
      setHasMore(false);
    }

    setLoadingMore(false);
  }, [displayedItems.length, hasMore, items, loadingMore, pageSize]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    const sentinel = sentinelRef.current;
    if (sentinel) {
      observerRef.current.observe(sentinel);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadMore, loadingMore]);

  return { displayedItems, sentinelRef, loadingMore, hasMore };
}
