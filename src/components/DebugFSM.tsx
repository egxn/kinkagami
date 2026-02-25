import React, { useEffect, useRef, useMemo, useState } from "react";
import type { Exercise, EventNode } from "../types/exercise";
import "./DebugFSM.scss";

interface DebugFSMProps {
  exercise: Exercise;
  isPlaying?: boolean;
  progress?: number; // 0 to 1 representing playback progress
}

// Zoom constants
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.2;

// Color palette for better visual distinction
const COLORS = {
  background: "#0d1117",
  nodeDefault: "#30363d",
  nodeStart: "#238636",
  nodeTerminal: "#8957e5",
  nodeActive: "#f78166",
  nodeVisited: "#388bfd",
  edge: "#484f58",
  edgeActive: "#f78166",
  text: "#e6edf3",
  textMuted: "#8b949e",
  border: "#30363d",
};

export const DebugFSM: React.FC<DebugFSMProps> = ({
  exercise,
  isPlaying = false,
  progress = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fitHeight, setFitHeight] = useState<number | null>(null);

  const handleZoomIn = () => {
    setFitHeight(null);
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  };
  const handleZoomOut = () => {
    setFitHeight(null);
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  };
  const handleFitToView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Calculate the height needed to show the full canvas at fit zoom
    const containerWidth = scrollContainerRef.current?.clientWidth ?? 800;
    const scaleX = (containerWidth - 40) / canvas.width; // 40px for padding
    const fitZoom = Math.min(scaleX, 1); // Don't zoom beyond 100%
    const clampedZoom = Math.max(MIN_ZOOM, Math.round(fitZoom * 10) / 10);
    
    // Calculate the required height to show full canvas
    const requiredHeight = canvas.height * clampedZoom + 60; // 60px for controls + padding
    
    setZoom(clampedZoom);
    setFitHeight(Math.max(300, requiredHeight));
  };

  // Compute layout once when exercise changes
  const layoutData = useMemo(() => {
    if (!exercise.event_graph || !exercise.completion) {
      return null;
    }

    const nodes = exercise.event_graph.nodes;
    const edges = exercise.event_graph.edges;

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

    // Assign layers (BFS-ish) - nodes with in-degree 0 are layer 0
    const queue = nodes
      .filter((n) => inDegree.get(n.id) === 0)
      .map((n) => n.id);

    queue.forEach((id) => {
      const n = nodeMap.get(id);
      if (n) n.layer = 0;
    });

    // Simple layering: child layer = parent layer + 1
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

    // Group by layer (horizontal layout: layers go left to right)
    const layers: string[][] = [];
    nodeMap.forEach((n) => {
      if (!layers[n.layer!]) layers[n.layer!] = [];
      layers[n.layer!].push(n.id);
    });

    // Get sorted node IDs for tracking progress
    const sortedNodeIds: string[] = [];
    layers.forEach((layer) => {
      sortedNodeIds.push(...layer);
    });

    return { nodeMap, edges, layers, sortedNodeIds };
  }, [exercise]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Guard for missing data
    if (!layoutData) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No event graph data available", canvas.width / 2, canvas.height / 2);
      return;
    }

    const { nodeMap, edges, layers, sortedNodeIds } = layoutData;

    // Calculate dimensions - HORIZONTAL layout
    const nodeWidth = 120;
    const nodeHeight = 50;
    const layerSpacing = 180; // horizontal spacing between layers
    const nodeSpacing = 80; // vertical spacing between nodes in same layer
    const padding = 60;

    // Find max nodes in any layer for height calculation (handle sparse arrays)
    const validLayers = layers.filter((l) => l && l.length > 0);
    const maxNodesInLayer = validLayers.length > 0 
      ? Math.max(...validLayers.map((l) => l.length)) 
      : 1;
    
    const canvasWidth = Math.max(800, validLayers.length * layerSpacing + padding * 2);
    const canvasHeight = Math.max(300, maxNodesInLayer * nodeSpacing + padding * 2);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Create a map from original layer index to visual position
    const layerToVisualIndex = new Map<number, number>();
    let visualIndex = 0;
    for (let i = 0; i < layers.length; i++) {
      if (layers[i] && layers[i].length > 0) {
        layerToVisualIndex.set(i, visualIndex);
        visualIndex++;
      }
    }

    // Calculate positions - HORIZONTAL layout (layers left to right)
    nodeMap.forEach((n) => {
      const layerNodes = layers[n.layer!];
      if (!layerNodes) {
        console.warn("[DebugFSM] Missing layer for node:", n.id, "layer:", n.layer);
        return;
      }
      const indexInLayer = layerNodes.indexOf(n.id);
      const layerHeightTotal = layerNodes.length * nodeSpacing;
      const startY = (canvasHeight - layerHeightTotal) / 2 + nodeSpacing / 2;

      // Use visual index for X position (to avoid gaps from sparse array)
      const visualLayerIndex = layerToVisualIndex.get(n.layer!) ?? 0;
      n.x = padding + visualLayerIndex * layerSpacing + nodeWidth / 2;
      n.y = startY + indexInLayer * nodeSpacing;
    });

    // --- Drawing ---
    // Background - use a slightly different color to verify canvas is rendering
    ctx.fillStyle = "#161b22";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines for visual reference
    ctx.strokeStyle = "#21262d";
    ctx.lineWidth = 1;
    for (let i = 0; i < validLayers.length; i++) {
      const x = padding + i * layerSpacing;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    // Determine active/visited nodes based on progress (0 to 1)
    // Map progress to node index: progress 0 = node 0, progress 1 = last node
    const totalNodes = sortedNodeIds.length;
    const currentNodeIdx = Math.min(
      Math.floor(progress * totalNodes),
      totalNodes - 1
    );
    const activeNodeId = sortedNodeIds[currentNodeIdx] || null;
    const visitedNodeIds = new Set(sortedNodeIds.slice(0, currentNodeIdx));

    // Draw edges first (behind nodes)
    edges.forEach((e) => {
      const from = nodeMap.get(e.from)!;
      const to = nodeMap.get(e.to)!;

      if (from.x === undefined || to.x === undefined) return;

      const fromX = from.x + nodeWidth / 2;
      const fromY = from.y ?? 0;
      const toX = to.x - nodeWidth / 2;
      const toY = to.y ?? 0;

      // Check if this edge is "active" (from visited to current)
      const isActive =
        isPlaying &&
        (visitedNodeIds.has(e.from) || e.from === activeNodeId) &&
        (e.to === activeNodeId || visitedNodeIds.has(e.to));

      // Draw curved edge for better visibility
      ctx.beginPath();
      ctx.strokeStyle = isActive ? COLORS.edgeActive : COLORS.edge;
      ctx.lineWidth = isActive ? 3 : 2;

      const controlPointOffset = Math.abs(toY - fromY) > 10 ? 50 : 30;
      ctx.moveTo(fromX, fromY);
      ctx.bezierCurveTo(
        fromX + controlPointOffset,
        fromY,
        toX - controlPointOffset,
        toY,
        toX,
        toY
      );
      ctx.stroke();

      // Arrowhead
      const arrowSize = 8;
      const angle = Math.atan2(toY - fromY, toX - (toX - controlPointOffset));
      ctx.fillStyle = isActive ? COLORS.edgeActive : COLORS.edge;
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - arrowSize * Math.cos(angle - Math.PI / 6),
        toY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        toX - arrowSize * Math.cos(angle + Math.PI / 6),
        toY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    });

    // Draw nodes
    nodeMap.forEach((n) => {
      if (n.x === undefined || n.y === undefined) {
        return;
      }

      const isTerminal = exercise.completion?.terminal_nodes.includes(n.id);
      const isStart = n.layer === 0;
      const isActive = isPlaying && n.id === activeNodeId;
      const isVisited = isPlaying && visitedNodeIds.has(n.id);

      // Node background
      let fillColor = COLORS.nodeDefault;
      if (isActive) fillColor = COLORS.nodeActive;
      else if (isVisited) fillColor = COLORS.nodeVisited;
      else if (isTerminal) fillColor = COLORS.nodeTerminal;
      else if (isStart) fillColor = COLORS.nodeStart;

      // Draw rounded rectangle
      const x = n.x - nodeWidth / 2;
      const y = n.y - nodeHeight / 2;
      const radius = 8;

      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + nodeWidth - radius, y);
      ctx.quadraticCurveTo(x + nodeWidth, y, x + nodeWidth, y + radius);
      ctx.lineTo(x + nodeWidth, y + nodeHeight - radius);
      ctx.quadraticCurveTo(x + nodeWidth, y + nodeHeight, x + nodeWidth - radius, y + nodeHeight);
      ctx.lineTo(x + radius, y + nodeHeight);
      ctx.quadraticCurveTo(x, y + nodeHeight, x, y + nodeHeight - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();

      ctx.fillStyle = fillColor;
      ctx.fill();

      // Border
      ctx.strokeStyle = isActive ? COLORS.edgeActive : COLORS.border;
      ctx.lineWidth = isActive ? 3 : 1;
      ctx.stroke();

      // Node label
      ctx.fillStyle = COLORS.text;
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Truncate long IDs and format nicely
      const displayId = n.id.length > 14 ? n.id.substring(0, 14) + "..." : n.id;
      ctx.fillText(displayId, n.x, n.y);

      // Small layer indicator
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = "9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`L${n.layer}`, n.x, n.y + nodeHeight / 2 - 8);
    });

    // Draw legend in corner
    const legendX = 10;
    const legendY = canvasHeight - 90;
    ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";

    const legendItems = [
      { color: COLORS.nodeStart, label: "Start" },
      { color: COLORS.nodeTerminal, label: "Terminal" },
      { color: COLORS.nodeVisited, label: "Visited" },
      { color: COLORS.nodeActive, label: "Active" },
    ];

    legendItems.forEach((item, i) => {
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, legendY + i * 18, 12, 12);
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText(item.label, legendX + 18, legendY + i * 18 + 9);
    });
  }, [exercise, layoutData, isPlaying, progress]);

  return (
    <div className="debug-fsm" ref={containerRef}>
      <div className="fsm-header">
        <h3>FSM: {exercise.name}</h3>
        <span className="node-count">
          {exercise.event_graph?.nodes.length || 0} nodes | {exercise.event_graph?.edges.length || 0} edges
        </span>
      </div>
      <div 
        className="canvas-container" 
        ref={scrollContainerRef}
        style={fitHeight ? { maxHeight: fitHeight, minHeight: fitHeight } : undefined}
      >
        <div className="zoom-controls">
          <button onClick={handleFitToView} title="Fit to view">
            ⊡
          </button>
          <button onClick={handleZoomOut} title="Zoom out" disabled={zoom <= MIN_ZOOM}>
            −
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} title="Zoom in" disabled={zoom >= MAX_ZOOM}>
            +
          </button>
        </div>
        <div className="canvas-scroll-area" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <canvas ref={canvasRef} width={800} height={300} />
        </div>
      </div>
      {exercise.event_graph && (
        <div className="legend">
          <details>
            <summary>View Raw Graph Data</summary>
            <pre>{JSON.stringify(exercise.event_graph, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
};
