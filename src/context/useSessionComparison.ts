import { useContext } from "react";
import { SessionComparisonContext } from "./SessionComparisonContextDef";

export function useSessionComparison() {
  const context = useContext(SessionComparisonContext);
  if (!context) {
    throw new Error("useSessionComparison must be used within SessionComparisonProvider");
  }
  return context;
}
