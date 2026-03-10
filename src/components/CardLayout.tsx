import Button from "./Button";
import usePoseContext from "../context/usePoseContext";
import { logger } from "../utils/logger";
import { useTranslation } from "react-i18next";
import "./CardLayout.scss";

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

  slots: Array<React.ReactNode | null>;
  actionSlots?: Array<React.ReactNode | null>;
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

export default function CardLayout({
  title,
  className,
  loading,
  error,
  isEmpty,
  loadingMessage,
  emptyMessage,
  errorPrefix,
  onRetry,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  slots,
  actionSlots,
  transitionDirection,
  transitionKey,
  navSlotWidth = 220,
  cardSlotFlex = 1.2,
  slotMinHeight = 520,
  actionSlotMinHeight = 120,
  cardSlotHeightPercent,
  actionSlotHeightPercent,
  navButtonSize = 200,
  footerButtonLabel,
  footerButtonOnAction,
  footerButtonOnDiscard,
  footerButtonClassName,
  footerButtonWidth = "80%",
  footerButtonMinHeight = 112,
  footerButtonDisabled = false,
  secondaryFooterButtonLabel,
  secondaryFooterButtonOnAction,
  secondaryFooterButtonOnDiscard,
  secondaryFooterButtonClassName,
  secondaryFooterButtonWidth = "80%",
  secondaryFooterButtonMinHeight = 112,
  secondaryFooterButtonDisabled = false,
}: CardLayoutProps) {
  const { t } = useTranslation();
  const { videoRef, streamReady } = usePoseContext();

  return (
    <div className={["card-layout", className].filter(Boolean).join(" ")}>
      <div className="card-layout__content">
        <div className="card-layout__header">
          <h1>{title}</h1>
        </div>

        {loading ? (
          <div className="card-layout__loading">{loadingMessage}</div>
        ) : error ? (
          <div className="card-layout__empty">
            {errorPrefix} {error.message}
            {onRetry ? (
              <div className="card-layout__retry">
                <Button
                  videoRef={videoRef}
                  streamReady={streamReady}
                  onAction={onRetry}
                  onDiscard={() =>
                    logger.log("CardLayout", "Retry action discarded")
                  }
                  alignX="center"
                  style={{ width: 220, minHeight: 72 }}
                >
                  <div>{t("common.retry")}</div>
                </Button>
              </div>
            ) : null}
          </div>
        ) : isEmpty ? (
          <div className="card-layout__empty">{emptyMessage}</div>
        ) : (
          <div className="card-layout__carousel">
            <div
              className="card-layout__slot card-layout__slot--nav"
              style={{ flex: `0 0 ${navSlotWidth}px` }}
            >
              {hasPrevious ? (
                <Button
                  videoRef={videoRef}
                  streamReady={streamReady}
                  onAction={onPrevious}
                  onDiscard={() =>
                    logger.log("CardLayout", "Previous action discarded")
                  }
                  alignX="center"
                  style={{
                    width: navButtonSize,
                    minWidth: navButtonSize,
                    minHeight: navButtonSize,
                  }}
                >
                  <div className="card-layout__nav-label">←</div>
                </Button>
              ) : null}
            </div>

            <div
              className={`card-layout__cards-track card-layout__cards-track--${transitionDirection}`}
              key={`${transitionDirection}-${transitionKey}`}
            >
              {slots.map((slot, slotIndex) => (
                <div
                  key={slotIndex}
                  className="card-layout__slot card-layout__slot--card"
                  style={{ flex: cardSlotFlex }}
                >
                  <div className="card-layout__slot-column">
                    <div
                      className="card-layout__slot-content"
                      style={
                        cardSlotHeightPercent != null
                          ? {
                              height: `${cardSlotHeightPercent}%`,
                              minHeight: 0,
                            }
                          : { minHeight: slotMinHeight }
                      }
                    >
                      {slot ?? (
                        <div className="card-layout__card-placeholder" />
                      )}
                    </div>

                    <div
                      className="card-layout__slot-actions"
                      style={
                        actionSlotHeightPercent != null
                          ? {
                              height: `${actionSlotHeightPercent}%`,
                              minHeight: 0,
                            }
                          : { minHeight: actionSlotMinHeight }
                      }
                    >
                      <div className="card-layout__slot-actions-content">
                        {actionSlots?.[slotIndex] ?? (
                          <div className="card-layout__slot-actions-empty">
                            —
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="card-layout__slot card-layout__slot--nav"
              style={{ flex: `0 0 ${navSlotWidth}px` }}
            >
              {hasNext ? (
                <Button
                  videoRef={videoRef}
                  streamReady={streamReady}
                  onAction={onNext}
                  onDiscard={() =>
                    logger.log("CardLayout", "Next action discarded")
                  }
                  alignX="center"
                  style={{
                    width: navButtonSize,
                    minWidth: navButtonSize,
                    minHeight: navButtonSize,
                  }}
                >
                  <div className="card-layout__nav-label">→</div>
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="card-layout__footer">
        <Button
          className={footerButtonClassName}
          videoRef={videoRef}
          streamReady={streamReady}
          onAction={() => {
            if (footerButtonDisabled) return;
            footerButtonOnAction();
          }}
          onDiscard={() => {
            if (footerButtonOnDiscard) {
              footerButtonOnDiscard();
            } else {
              logger.log("CardLayout", "Footer action discarded");
            }
          }}
          alignX="center"
          style={{ width: footerButtonWidth, minHeight: footerButtonMinHeight }}
        >
          <div>{footerButtonLabel}</div>
        </Button>

        {secondaryFooterButtonLabel && secondaryFooterButtonOnAction ? (
          <Button
            className={secondaryFooterButtonClassName}
            videoRef={videoRef}
            streamReady={streamReady}
            onAction={() => {
              if (secondaryFooterButtonDisabled) return;
              secondaryFooterButtonOnAction();
            }}
            onDiscard={() => {
              if (secondaryFooterButtonOnDiscard) {
                secondaryFooterButtonOnDiscard();
              } else {
                logger.log("CardLayout", "Secondary footer action discarded");
              }
            }}
            alignX="center"
            style={{
              width: secondaryFooterButtonWidth,
              minHeight: secondaryFooterButtonMinHeight,
            }}
          >
            <div>{secondaryFooterButtonLabel}</div>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
