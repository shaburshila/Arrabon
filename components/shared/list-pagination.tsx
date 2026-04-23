"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";

interface ListPaginationProps {
  currentPage: number;
  hasNextPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
}

export function ListPagination({
  currentPage,
  hasNextPage,
  onNext,
  onPrevious,
}: ListPaginationProps) {
  const canGoPrevious = currentPage > 0;
  const canGoNext = hasNextPage;

  return (
    <nav aria-label="Pagination" style={navStyle}>
      <button
        aria-label="Go to previous page"
        disabled={!canGoPrevious}
        onClick={onPrevious}
        style={{
          ...pageButtonStyle,
          ...(!canGoPrevious ? disabledStyle : {}),
        }}
        type="button"
      >
        <ChevronLeft size={15} />
        <span>Previous</span>
      </button>

      <span style={pageIndicatorStyle}>Page {currentPage + 1}</span>

      <button
        aria-label="Go to next page"
        disabled={!canGoNext}
        onClick={onNext}
        style={{
          ...pageButtonStyle,
          ...(!canGoNext ? disabledStyle : {}),
        }}
        type="button"
      >
        <span>Next</span>
        <ChevronRight size={15} />
      </button>
    </nav>
  );
}

const navStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "center",
  marginTop: 14,
};

const pageButtonStyle: CSSProperties = {
  alignItems: "center",
  background: "var(--muted-bg)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--foreground)",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: 13,
  fontWeight: 500,
  gap: 4,
  minHeight: 36,
  padding: "0 12px",
  transition: "opacity 0.15s, background 0.15s",
};

const disabledStyle: CSSProperties = {
  cursor: "not-allowed",
  opacity: 0.45,
};

const pageIndicatorStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  minWidth: 56,
  textAlign: "center",
};
