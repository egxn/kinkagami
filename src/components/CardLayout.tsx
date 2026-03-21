import type { ReactNode, CSSProperties } from "react";
import { CardLayout as CardLayoutUI } from "../ui";
import Button from "./Button";
import usePoseContext from "../context/usePoseContext";
import { logger } from "../utils/logger";

export interface CardLayoutProps {
  title: string;
  className?: string;
  loading: boolean;
  error?: Error | null;
  isEmpty: boolean;
  loadingMessage: string;
  emptyMessage: string;
  errorPrefix: string;
  onRetry?: () => void;

  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;

  slots: Array<ReactNode | null>;
  actionSlots?: Array<ReactNode | null>;
  transitionDirection: "forward" | "backward";
  transitionKey: string | number;

  navSlotWidth?: number;
  cardSlotFlex?: number;
  slotMinHeight?: number;
  actionSlotMinHeight?: number;
  cardSlotHeightPercent?: number;
  actionSlotHeightPercent?: number;
  navButtonSize?: number;

  footerButtonLabel: string;
  footerButtonOnAction: () => void;
  footerButtonOnDiscard?: () => void;
  footerButtonClassName?: string;
  footerButtonWidth?: string | number;
  footerButtonMinHeight?: number;
  footerButtonDisabled?: boolean;

  secondaryFooterButtonLabel?: string;
  secondaryFooterButtonOnAction?: () => void;
  secondaryFooterButtonOnDiscard?: () => void;
  secondaryFooterButtonClassName?: string;
  secondaryFooterButtonWidth?: string | number;
  secondaryFooterButtonMinHeight?: number;
  secondaryFooterButtonDisabled?: boolean;
}

export default function CardLayout(props: CardLayoutProps) {
  const { videoRef, streamReady } = usePoseContext();

  const renderButton = ({
    onAction,
    onDiscard,
    alignX,
    style,
    className,
    children,
  }: {
    onAction: () => void;
    onDiscard: () => void;
    alignX?: "auto" | "left" | "center";
    style?: CSSProperties;
    className?: string;
    children: ReactNode;
  }) => (
    <Button
      videoRef={videoRef}
      streamReady={streamReady}
      onAction={onAction}
      onDiscard={() => {
        onDiscard();
        logger.log("CardLayout", "Button action discarded");
      }}
      alignX={alignX}
      style={style}
      className={className}
    >
      {children}
    </Button>
  );

  return <CardLayoutUI {...props} renderButton={renderButton} />;
}
