import { useNavigate } from "react-router-dom";
import Button from "../../../components/Button";
import usePoseContext from "../../../context/usePoseContext";

export default function PlayHome() {
  const navigate = useNavigate();
  const { streamReady, videoRef } = usePoseContext();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: "min(34rem, 86vw)",
          display: "grid",
          gap: "1.25rem",
          justifyItems: "center",
          textAlign: "center",
          color: "#f6f1d1",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <div style={{ fontSize: "2rem", fontWeight: 800 }}>play</div>
        <div style={{ opacity: 0.78, fontSize: "0.82rem" }}>
          choose a game mode
        </div>
        <Button
          videoRef={videoRef}
          streamReady={streamReady}
          onAction={() => navigate("/play/box")}
          onDiscard={() => {}}
          alignX="center"
          style={{ minWidth: 260 }}
        >
          <div>box</div>
        </Button>
      </div>
    </div>
  );
}