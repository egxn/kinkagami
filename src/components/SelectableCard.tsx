import type { ReactNode } from "react";
import "./SelectableCard.scss";

interface SelectableCardProps {
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  className?: string;
  children: ReactNode;
}

export default function SelectableCard({
  selected = false,
  onClick,
  onDoubleClick,
  className,
  children,
}: SelectableCardProps) {
  return (
    <div
      className={`selectable-card ${selected ? "selectable-card--selected" : ""} ${className ?? ""}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <div className="selectable-card__content">{children}</div>
      {selected && <div className="selectable-card__check">✓</div>}
    </div>
  );
}
