import type { CSSProperties } from "react";
import type { BoxRoundOutcome } from "./box_gameplay";
import type {
  BoxDifficulty,
  BoxPunch,
  BoxRivalPalette,
  BoxRivalPhysique,
} from "./box_gear";

interface BoxScoreProps {
  playerHealth: number;
  rivalHealth: number;
  score: number;
  combo: number;
  debugSeed?: number;
  difficulty: BoxDifficulty;
  remainingSeconds: number;
  rivalPhysique: BoxRivalPhysique;
  rivalPalette: BoxRivalPalette;
  incomingPunch: BoxPunch | null;
  defensePrompt: string;
  lastDefenseResult: string;
  successfulDefenses: number;
  missedDefenses: number;
  roundOutcome: BoxRoundOutcome;
}

const ROOT_STYLE: CSSProperties = {
  color: "#f6f1d1",
  display: "grid",
  gap: "0.8rem",
  left: "2rem",
  letterSpacing: "0.08em",
  position: "absolute",
  textTransform: "uppercase",
  top: "2rem",
  width: "min(26rem, 34vw)",
  zIndex: 30,
};

const PANEL_STYLE: CSSProperties = {
  backdropFilter: "blur(8px)",
  background: "rgba(12, 18, 20, 0.42)",
  border: "1px solid rgba(246, 241, 209, 0.18)",
  borderRadius: "18px",
  padding: "1rem 1.1rem",
};

const HEALTH_BAR_SHELL: CSSProperties = {
  background: "rgba(255, 255, 255, 0.08)",
  borderRadius: "999px",
  height: "0.7rem",
  overflow: "hidden",
  width: "100%",
};

const metaLine = (label: string, value: string | number) => (
  <div
    key={label}
    style={{
      display: "flex",
      justifyContent: "space-between",
      gap: "1rem",
      fontSize: "0.78rem",
    }}
  >
    <span style={{ opacity: 0.68 }}>{label}</span>
    <span>{value}</span>
  </div>
);

function HealthBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.74rem",
        }}
      >
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={HEALTH_BAR_SHELL}>
        <div
          style={{
            background: color,
            borderRadius: "999px",
            height: "100%",
            transition: "width 160ms ease-out",
            width: `${Math.max(0, Math.min(100, value))}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function BoxScore({
  playerHealth,
  rivalHealth,
  score,
  combo,
  debugSeed,
  difficulty,
  remainingSeconds,
  rivalPhysique,
  rivalPalette,
  incomingPunch,
  defensePrompt,
  lastDefenseResult,
  successfulDefenses,
  missedDefenses,
  roundOutcome,
}: BoxScoreProps) {
  return (
    <div style={ROOT_STYLE}>
      <div style={PANEL_STYLE}>
        <div style={{ fontSize: "0.72rem", opacity: 0.72 }}>mode: box</div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: "0.3rem",
          }}
        >
          <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{score}</div>
          <div style={{ fontSize: "0.82rem", color: "#ffd166" }}>
            combo x{Math.max(1, combo)}
          </div>
        </div>
      </div>

      <div style={{ ...PANEL_STYLE, display: "grid", gap: "0.85rem" }}>
        <HealthBar label="player" value={playerHealth} color="#54f1a7" />
        <HealthBar label="rival" value={rivalHealth} color="#ff8a5b" />
      </div>

      <div style={{ ...PANEL_STYLE, display: "grid", gap: "0.55rem" }}>
        {metaLine("difficulty", difficulty)}
        {metaLine("timer", `${remainingSeconds}s`)}
        {metaLine("rival build", rivalPhysique)}
        {metaLine("palette", rivalPalette)}
        {metaLine("incoming", incomingPunch ?? "idle")}
        {metaLine("defense", defensePrompt)}
        {metaLine("status", lastDefenseResult)}
        {metaLine("round state", roundOutcome)}
        {metaLine("clean defenses", successfulDefenses)}
        {metaLine("taken hits", missedDefenses)}
        {typeof debugSeed === "number" ? metaLine("debug seed", debugSeed) : null}
      </div>
    </div>
  );
}