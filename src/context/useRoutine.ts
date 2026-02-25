import { useContext } from "react";
import { RoutineContext } from "./RoutineContextDef";

export const useRoutine = () => {
  const context = useContext(RoutineContext);
  if (!context) {
    throw new Error("useRoutine must be used within a RoutineProvider");
  }
  return context;
};
