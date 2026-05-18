import type { CSSProperties } from "react";

interface BoxRoundTimerProps {
  remainingSeconds: number;
  active: boolean;
}

const ROOT_STYLE: CSSProperties = {
  position: "absolute",
  top: "1.5rem",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 34,
  pointerEvents: "none",
};

export default function BoxRoundTimer({
  remainingSeconds,
  active,
}: BoxRoundTimerProps) {
  const isUrgent = active && remainingSeconds <= 10;

  return (
    <div style={ROOT_STYLE}>
      <div
        style={{
          minWidth: "7.5rem",
          padding: "0.55rem 1rem",
          borderRadius: "999px",
          textAlign: "center",
          color: isUrgent ? "#fff1e0" : "#f6f1d1",
          background: isUrgent
            ? "rgba(210, 45, 45, 0.78)"
            : "rgba(8, 12, 16, 0.58)",
          border: isUrgent
            ? "2px solid rgba(255, 179, 102, 0.88)"
            : "1px solid rgba(246, 241, 209, 0.18)",
          backdropFilter: "blur(10px)",
          boxShadow: isUrgent
            ? "0 0 28px rgba(255, 82, 82, 0.42)"
            : "0 0 18px rgba(0, 0, 0, 0.18)",
          fontSize: isUrgent ? "2rem" : "1.7rem",
          fontWeight: 800,
          letterSpacing: "0.12em",
          transition:
            "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, font-size 160ms ease",
        }}
      >
        {remainingSeconds}
      </div>
      <div
        style={{
          marginTop: "0.35rem",
          textAlign: "center",
          color: "rgba(246, 241, 209, 0.74)",
          fontSize: "0.72rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        {isUrgent ? "final seconds" : active ? "round timer" : "round over"}
      </div>
    </div>
  );
}