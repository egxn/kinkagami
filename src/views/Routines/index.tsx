import "./Routines.scss";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import RoutineCard from "../../components/RoutineCard";
import CardLayout from "../../components/CardLayout";
import { useRoutines } from "../../hooks/useRoutines";
import { usePagedCarousel } from "../../hooks";
import type { Routine } from "../../types/exercise";
import { useRoutine } from "../../context/useRoutine";
import { logger } from "../../utils/logger";
import Button from "../../components/Button";
import usePoseContext from "../../context/usePoseContext";

const ROUTINES_PER_PAGE = 1;

interface RoutinesViewProps {
  routines: Routine[];
  loading: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onDiscardRoutine?: (routine: Routine) => void | Promise<void>;
}

export function RoutinesView({
  routines,
  loading,
  error,
  onRetry,
  onDiscardRoutine,
}: RoutinesViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setSelectedRoutine } = useRoutine();
  const { videoRef, streamReady } = usePoseContext();
  const {
    pageItems: routinesToRender,
    startIndex,
    hasPrevious,
    hasNext,
    transitionDirection,
    goPrevious,
    goNext,
  } = usePagedCarousel(routines, ROUTINES_PER_PAGE);
  const currentRoutine = routinesToRender[0] ?? null;

  logger.log("RoutinesView", "Render state", {
    loading,
    hasError: !!error,
    routinesCount: routines.length,
    startIndex,
    hasPrevious,
    hasNext,
    routinesToRenderCount: routinesToRender.length,
  });

  const slotNodes = [
    currentRoutine ? (
      <RoutineCard
        routine={currentRoutine}
        onDoubleClick={() => {
          setSelectedRoutine(currentRoutine);
          navigate("/stack/session");
        }}
        onDiscard={() => {
          if (!onDiscardRoutine) {
            logger.log(
              "RoutinesView",
              "Routine discard action ignored (no handler)",
              {
                routineId: currentRoutine._id ?? null,
                routineName: currentRoutine.name ?? null,
              },
            );
            return;
          }

          void onDiscardRoutine(currentRoutine);
        }}
      />
    ) : null,
  ];

  const actionSlotNodes = [
    currentRoutine ? (
      <Button
        videoRef={videoRef}
        streamReady={streamReady}
        onAction={() => {
          if (!onDiscardRoutine) {
            logger.log(
              "RoutinesView",
              "Routine delete action ignored (no handler)",
              {
                routineId: currentRoutine._id ?? null,
                routineName: currentRoutine.name ?? null,
              },
            );
            return;
          }

          void onDiscardRoutine(currentRoutine);
        }}
        onDiscard={() =>
          logger.log("RoutinesView", "Routine delete action discarded", {
            routineId: currentRoutine._id ?? null,
            routineName: currentRoutine.name ?? null,
          })
        }
        alignX="center"
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          borderTop: "none",
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
      >
        <div>{t("routines.delete")}</div>
      </Button>
    ) : null,
  ];

  return (
    <CardLayout
      className="routines-view"
      title={t("routines.title")}
      loading={loading}
      error={error}
      isEmpty={!currentRoutine && !loading && !error}
      loadingMessage={t("routines.loading")}
      emptyMessage={t("routines.empty")}
      errorPrefix={t("routines.error_prefix")}
      onRetry={onRetry}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      onPrevious={goPrevious}
      onNext={goNext}
      slots={slotNodes}
      actionSlots={actionSlotNodes}
      transitionDirection={transitionDirection}
      transitionKey={startIndex}
      navSlotWidth={160}
      cardSlotFlex={1}
      cardSlotHeightPercent={76}
      actionSlotHeightPercent={24}
      navButtonSize={140}
      footerButtonLabel={t("routines.new_routine")}
      footerButtonOnAction={() => navigate("/stack/exercises")}
      footerButtonOnDiscard={() =>
        logger.log("RoutinesView", "New routine action discarded")
      }
      footerButtonClassName="routines-view__new-btn"
      footerButtonWidth="80%"
      footerButtonMinHeight={112}
      footerButtonDisabled={false}
    />
  );
}

export default function Routines() {
  const { routines, loading, error, refreshRoutines, deleteRoutineData } =
    useRoutines();
  const { selectedRoutine, setSelectedRoutine } = useRoutine();
  return (
    <RoutinesView
      routines={routines}
      loading={loading}
      error={error}
      onDiscardRoutine={async (routine) => {
        if (!routine._id) {
          logger.error("RoutinesView", "Cannot delete routine without _id", {
            routineName: routine.name ?? null,
          });
          return;
        }

        await deleteRoutineData(routine._id);

        if (selectedRoutine?._id === routine._id) {
          setSelectedRoutine(null);
        }

        logger.log("RoutinesView", "Routine discarded", {
          routineId: routine._id,
          routineName: routine.name ?? null,
        });
      }}
      onRetry={() => {
        void refreshRoutines();
      }}
    />
  );
}
