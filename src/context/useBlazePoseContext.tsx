import { useContext } from "react";
import BlazePoseContext from "./BlazePoseContext";

const useBlazePoseContext = () => {
  const context = useContext(BlazePoseContext);
  if (!context) {
    throw new Error("useBlazePoseContext must be used within BlazePoseProvider");
  }
  return context;
};

export default useBlazePoseContext;
