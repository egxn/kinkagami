import "./BoxDamageOverlay.scss";

interface BoxDamageOverlayProps {
  trigger: number;
}

export default function BoxDamageOverlay({
  trigger,
}: BoxDamageOverlayProps) {
  if (trigger === 0) {
    return null;
  }

  return (
    <div className="box-damage-overlay">
      <div key={trigger} className="box-damage-overlay__flash" />
    </div>
  );
}