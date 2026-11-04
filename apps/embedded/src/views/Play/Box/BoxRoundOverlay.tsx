import type { CSSProperties, ReactNode } from "react";
import type { BoxRoundOutcome } from "./box_gameplay";

interface BoxRoundOverlayProps {
  outcome: BoxRoundOutcome;
  score: number;
  playerHealth: number;
  rivalHealth: number;
  actions?: ReactNode;
}

const ROOT_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  pointerEvents: "none",
  zIndex: 45,
};

const CARD_STYLE: CSSProperties = {
  minWidth: "min(28rem, 72vw)",
  padding: "1.4rem 1.6rem",
  borderRadius: "24px",
  backdropFilter: "blur(12px)",
  background: "rgba(8, 12, 16, 0.64)",
  border: "1px solid rgba(246, 241, 209, 0.18)",
  color: "#f6f1d1",
  textAlign: "center",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  pointerEvents: "auto",
};

const getOverlayCopy = (outcome: BoxRoundOutcome) => {
  switch (outcome) {
    case "rivalKO":
      return { title: "KO", subtitle: "rival down" };
    case "playerKO":
      return { title: "knocked out", subtitle: "player down" };
    case "timeUpWin":
      return { title: "time up", subtitle: "you win on points" };
    case "timeUpLose":
      return { title: "time up", subtitle: "rival wins on points" };
    case "timeUpDraw":
      return { title: "time up", subtitle: "draw" };
    default:
      return null;
  }
};

export default function BoxRoundOverlay({
  outcome,
  score,
  playerHealth,
  rivalHealth,
  actions,
}: BoxRoundOverlayProps) {
  const copy = getOverlayCopy(outcome);

  if (!copy) {
    return null;
  }

  return (
    <div style={ROOT_STYLE}>
      <div style={CARD_STYLE}>
        <div style={{ fontSize: "2rem", fontWeight: 700 }}>{copy.title}</div>
        <div style={{ marginTop: "0.5rem", opacity: 0.82 }}>{copy.subtitle}</div>
        <div
          style={{
            marginTop: "1rem",
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            fontSize: "0.82rem",
          }}
        >
          <span>score {score}</span>
          <span>player {playerHealth}</span>
          <span>rival {rivalHealth}</span>
        </div>
        {actions ? <div style={{ marginTop: "1.15rem" }}>{actions}</div> : null}
      </div>
    </div>
  );
}