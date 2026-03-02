import { useCallback, useMemo, useState } from "react";

export interface UsePagedCarouselResult<T> {
  pageItems: T[];
  startIndex: number;
  hasPrevious: boolean;
  hasNext: boolean;
  transitionDirection: "forward" | "backward";
  goPrevious: () => void;
  goNext: () => void;
}

export function usePagedCarousel<T>(
  items: T[],
  itemsPerPage: number,
): UsePagedCarouselResult<T> {
  const [startIndex, setStartIndex] = useState(0);
  const [transitionDirection, setTransitionDirection] = useState<"forward" | "backward">("forward");

  const maxStart = Math.max(0, items.length - itemsPerPage);
  const clampedStartIndex = Math.min(startIndex, maxStart);

  const pageItems = useMemo(
    () => items.slice(clampedStartIndex, clampedStartIndex + itemsPerPage),
    [items, clampedStartIndex, itemsPerPage],
  );

  const hasPrevious = clampedStartIndex > 0;
  const hasNext = clampedStartIndex + itemsPerPage < items.length;

  const goPrevious = useCallback(() => {
    setTransitionDirection("backward");
    setStartIndex((prev) => Math.max(0, prev - itemsPerPage));
  }, [itemsPerPage]);

  const goNext = useCallback(() => {
    setTransitionDirection("forward");
    setStartIndex((prev) =>
      Math.min(prev + itemsPerPage, Math.max(0, items.length - itemsPerPage)),
    );
  }, [items.length, itemsPerPage]);

  return {
    pageItems,
    startIndex: clampedStartIndex,
    hasPrevious,
    hasNext,
    transitionDirection,
    goPrevious,
    goNext,
  };
}
