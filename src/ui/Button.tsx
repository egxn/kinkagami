import { Children, isValidElement, useMemo, forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import "./Button.scss";

export interface ButtonProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  alignX?: "auto" | "left" | "center";
  mode?: "default" | "checkbox";
  checked?: boolean;
  isHovered?: boolean;
  isFocused?: boolean;
  isCameraLoading?: boolean;
  isModelLoading?: boolean;
  onClick?: () => void;
}

const isTextOnlyNode = (node: ReactNode): boolean => {
  if (node == null || typeof node === "boolean") return true;
  if (typeof node === "string") return node.trim().length > 0;
  if (typeof node === "number") return true;
  if (Array.isArray(node)) return node.every((child) => isTextOnlyNode(child));

  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return isTextOnlyNode(props.children);
  }

  return false;
};

const Button = forwardRef<HTMLDivElement, ButtonProps>(function Button(
  {
    children,
    className,
    style,
    alignX = "auto",
    mode = "default",
    checked = false,
    isHovered = false,
    isFocused = false,
    isCameraLoading = false,
    isModelLoading = false,
    onClick,
  },
  ref,
) {
  const isAnyLoading = isCameraLoading || isModelLoading;

  const hasChildren = Children.count(children) > 0;
  const hasOnlyTextChildren = useMemo(
    () => isTextOnlyNode(children),
    [children],
  );
  const useLargeMinimumSize = !hasChildren || hasOnlyTextChildren;
  const contentAlignX: "left" | "center" =
    alignX === "auto" ? (hasOnlyTextChildren ? "center" : "left") : alignX;

  const resolveVisualStyle = () => {
    if (isCameraLoading) {
      return {
        border: "2px solid var(--kgm-button-loading-border)",
        backgroundColor: "var(--kgm-button-loading-surface)",
      };
    }

    if (isModelLoading) {
      return {
        border: "2px solid var(--kgm-button-loading-border)",
        backgroundColor: "var(--kgm-button-loading-surface)",
      };
    }

    if (mode === "checkbox" && checked) {
      if (isFocused) {
        return {
          border: "4px solid var(--kgm-button-checkbox-checked-focus-border)",
          backgroundColor: "var(--kgm-button-checkbox-checked-focus-surface)",
        };
      }

      return {
        border: "4px solid var(--kgm-button-checkbox-checked-border)",
        backgroundColor: "var(--kgm-button-checkbox-checked-surface)",
      };
    }

    if (mode === "checkbox" && isFocused) {
      return {
        border: "2px solid var(--kgm-button-checkbox-hover-border)",
        backgroundColor: "var(--kgm-button-checkbox-hover-surface)",
      };
    }

    if (isFocused) {
      return {
        border: "2px solid var(--kgm-button-focus-border)",
        backgroundColor: "var(--kgm-button-focus-surface)",
      };
    }

    if (isHovered) {
      if (mode === "checkbox") {
        return {
          border: "2px solid var(--kgm-button-checkbox-hover-border)",
          backgroundColor: "var(--kgm-button-checkbox-hover-surface)",
        };
      }

      return {
        border: "2px solid var(--kgm-button-hover-border)",
        backgroundColor: "var(--kgm-button-hover-surface)",
      };
    }

    return {
      border: "2px solid var(--kgm-button-idle-border)",
      backgroundColor: "var(--kgm-button-idle-surface)",
    };
  };

  const showHover =
    !isAnyLoading && !(mode === "checkbox" && checked) && isHovered;
  const showCheckboxIndicator = mode === "checkbox" && checked;

  return (
    <div
      ref={ref}
      className={[
        "kgm-button",
        className,
        isAnyLoading ? "kgm-button--loading" : "",
        showHover ? "kgm-button--hovered" : "",
        isFocused ? "kgm-button--focused" : "",
        showCheckboxIndicator ? "kgm-button--checked" : "",
        contentAlignX === "center"
          ? "kgm-button--align-center"
          : "kgm-button--align-left",
      ]
        .filter(Boolean)
        .join(" ")}
      role="button"
      tabIndex={0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-start",
        width: "fit-content",
        minWidth: 200,
        minHeight: useLargeMinimumSize ? 200 : undefined,
        padding: "8px 16px",
        borderRadius: 10,
        ...resolveVisualStyle(),
        color: "white",
        userSelect: "none",
        transition:
          "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        cursor: isAnyLoading ? "progress" : "pointer",
        boxShadow: showCheckboxIndicator
          ? "0 0 0 2px rgba(88, 214, 141, 0.3), inset 0 0 18px rgba(88, 214, 141, 0.22)"
          : showHover
            ? "var(--kgm-button-hover-glow)"
            : undefined,
        ...style,
      }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
    >
      {showCheckboxIndicator ? (
        <span className="kgm-button__check">✓</span>
      ) : null}
      <span className="kgm-button__content">{children}</span>
    </div>
  );
});

export default Button;
