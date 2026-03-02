import "./Routines.scss";
import { useNavigate } from "react-router-dom";
import RoutineCard from "../../components/RoutineCard";
import CardLayout from "../../components/CardLayout";
import { useRoutines } from "../../hooks/useRoutines";
import { usePagedCarousel } from "../../hooks";
import type { Routine } from "../../types/exercise";
import { useRoutine } from "../../context/useRoutine";
import { logger } from "../../utils/logger";
import Button from "../../components/Button";
import usePoseContext from "../../context/usePoseContext";

const ROUTINES_PER_PAGE = 2;

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
  const visibleSlots = [
    routinesToRender[0] ?? null,
    routinesToRender[1] ?? null,
  ] as const;

  logger.log("RoutinesView", "Render state", {
    loading,
    hasError: !!error,
    routinesCount: routines.length,
    startIndex,
    hasPrevious,
    hasNext,
    routinesToRenderCount: routinesToRender.length,
  });

  const slotNodes = visibleSlots.map((routine) =>
    routine ? (
      <RoutineCard
        routine={routine}
        onDoubleClick={() => {
          setSelectedRoutine(routine);
          navigate("/stack/session");
        }}
        onDiscard={() => {
          if (!onDiscardRoutine) {
            logger.log(
              "RoutinesView",
              "Routine discard action ignored (no handler)",
              {
                routineId: routine._id ?? null,
                routineName: routine.name ?? null,
              },
            );
            return;
          }

          void onDiscardRoutine(routine);
        }}
      />
    ) : null,
  );

  const actionSlotNodes = visibleSlots.map((routine) =>
    routine ? (
      <Button
        videoRef={videoRef}
        streamReady={streamReady}
        onAction={() => {
          if (!onDiscardRoutine) {
            logger.log(
              "RoutinesView",
              "Routine delete action ignored (no handler)",
              {
                routineId: routine._id ?? null,
                routineName: routine.name ?? null,
              },
            );
            return;
          }

          void onDiscardRoutine(routine);
        }}
        onDiscard={() =>
          logger.log("RoutinesView", "Routine delete action discarded", {
            routineId: routine._id ?? null,
            routineName: routine.name ?? null,
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
        <div>Eliminar</div>
      </Button>
    ) : null,
  );

  return (
    <CardLayout
      className="routines-view"
      title="Rutinas"
      loading={loading}
      error={error}
      isEmpty={routinesToRender.length === 0}
      loadingMessage="Cargando rutinas..."
      emptyMessage="No hay rutinas guardadas"
      errorPrefix="Error cargando rutinas:"
      onRetry={onRetry}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      onPrevious={goPrevious}
      onNext={goNext}
      slots={slotNodes}
      actionSlots={actionSlotNodes}
      transitionDirection={transitionDirection}
      transitionKey={startIndex}
      navSlotWidth={220}
      cardSlotFlex={1.6}
      cardSlotHeightPercent={78}
      actionSlotHeightPercent={22}
      navButtonSize={200}
      footerButtonLabel="Nueva rutina"
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
