import React, { useEffect, useRef } from "react";
import type { ExerciseDef, EventNode } from "../types/exercise";
import "./DebugFSM.scss";

interface DebugFSMProps {
  exercise: ExerciseDef;
}

export const DebugFSM: React.FC<DebugFSMProps> = ({ exercise }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    // --- Graph Layout Algorithm (Simple Layering) ---
    const nodes = exercise.event_graph.nodes;
    const edges = exercise.event_graph.edges;

    // 1. Identify start nodes (nodes with no incoming edges)
    // Actually, FSM usually starts at specific start nodes, or implied first ones.
    // For this viz, let's use topological sort / layering.

    // Map node IDs to objects for easier access
    const nodeMap = new Map<
      string,
      EventNode & { layer?: number; x?: number; y?: number }
    >();
    nodes.forEach((n) => nodeMap.set(n.id, { ...n }));

    // Compute in-degrees
    const inDegree = new Map<string, number>();
    nodes.forEach((n) => inDegree.set(n.id, 0));
    edges.forEach((e) => {
      inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    });

    // Assign layers (BFS-ish)
    // Nodes with in-degree 0 are layer 0
    const queue = nodes
      .filter((n) => inDegree.get(n.id) === 0)
      .map((n) => n.id);
    const visited = new Set<string>();

    // If cyclic (rare for exercises but possible), we need standard visited check
    queue.forEach((id) => {
      const n = nodeMap.get(id);
      if (n) n.layer = 0;
      visited.add(id);
    });

    // Simple layering: child layer = parent layer + 1
    // This assumes DAG. If cycle, we break it arbitrarily or max-layer cap.
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 100) {
      changed = false;
      edges.forEach((e) => {
        const fromNode = nodeMap.get(e.from);
        const toNode = nodeMap.get(e.to);
        if (fromNode && toNode && fromNode.layer !== undefined) {
          if (toNode.layer === undefined || toNode.layer < fromNode.layer + 1) {
            toNode.layer = fromNode.layer + 1;
            changed = true;
          }
        }
      });
      iterations++;
    }

    // Handle unreachables/cycles fallback
    nodeMap.forEach((n) => {
      if (n.layer === undefined) n.layer = 0;
    });

    // Group by layer
    const layers: string[][] = [];
    nodeMap.forEach((n) => {
      if (!layers[n.layer!]) layers[n.layer!] = [];
      layers[n.layer!].push(n.id);
    });

    // Calculate positions
    const nodeRadius = 30;
    const layerHeight = 100;
    const canvasWidth = canvas.width;
    const canvasHeight = Math.max(600, layers.length * layerHeight + 100);

    // Resize canvas height if needed (though modifying ref height triggers re-render loop if strictly reactive, but here we just draw)
    // Lets stick to fixed size or dynamic?
    canvas.height = canvasHeight; // works inside useEffect

    nodeMap.forEach((n) => {
      const layerNodes = layers[n.layer!];
      const indexInLayer = layerNodes.indexOf(n.id);
      const layerWidth = layerNodes.length * 120; // assumed spacing
      const startX = (canvasWidth - layerWidth) / 2 + 60; // center the layer

      n.x = startX + indexInLayer * 120;
      n.y = 50 + n.layer! * layerHeight;
    });

    // --- Drawing ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

    // Draw edges
    edges.forEach((e) => {
      const from = nodeMap.get(e.from)!;
      const to = nodeMap.get(e.to)!;

      if (from.x !== undefined && to.x !== undefined) {
        ctx.beginPath();
        ctx.moveTo(from.x, (from.y ?? 0) + nodeRadius);
        ctx.lineTo(to.x, (to.y ?? 0) - nodeRadius);
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(
          (to.y ?? 0) - nodeRadius - ((from.y ?? 0) + nodeRadius),
          to.x - from.x,
        );
        ctx.beginPath();
        ctx.moveTo(to.x, (to.y ?? 0) - nodeRadius);
        ctx.lineTo(
          to.x - 10 * Math.cos(angle - Math.PI / 6),
          (to.y ?? 0) - nodeRadius - 10 * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(
          to.x - 10 * Math.cos(angle + Math.PI / 6),
          (to.y ?? 0) - nodeRadius - 10 * Math.sin(angle + Math.PI / 6),
        );
        ctx.fill();
      }
    });

    // Draw nodes
    nodeMap.forEach((n) => {
      if (n.x === undefined || n.y === undefined) return;

      ctx.beginPath();
      ctx.arc(n.x, n.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = exercise.completion.terminal_nodes.includes(n.id)
        ? "#4caf50" // green for terminal
        : n.layer === 0
          ? "#2196f3" // blue for start
          : "#555"; // grey default
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "white";
      // Wrap text roughly? specific ID
      ctx.fillText(n.id.substring(0, 10), n.x, n.y);
      if (n.id.length > 10) ctx.fillText(n.id.substring(10, 20), n.x, n.y + 12);
    });
  }, [exercise]);

  return (
    <div className="debug-fsm">
      <h2>FSM Debug: {exercise.name}</h2>
      <canvas ref={canvasRef} width={800} height={600} />
      <div className="legend">
        <p>Blue: Start Layer | Green: Terminal/Completion Nodes</p>
        <pre>{JSON.stringify(exercise.event_graph, null, 2)}</pre>
      </div>
    </div>
  );
};
