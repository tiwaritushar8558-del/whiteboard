import { useState, useEffect, useRef, useCallback } from "react";

const TOOLS = ["pen","eraser","rect","circle","ellipse","triangle","line","arrow","text","sticky","select","fill","eyedropper","zoom"];
const FONTS = ["Arial","Georgia","Courier New","Verdana","Impact","Comic Sans MS"];
const COLORS = ["#000000","#ffffff","#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#6366f1","#f59e0b","#10b981","#64748b","#a855f7","#06b6d4"];
const OPACITIES = [1,0.75,0.5,0.25];

function generateId() { return Math.random().toString(36).slice(2); }

const HISTORY_LIMIT = 50;

export default function App() {
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [fillColor, setFillColor] = useState("#3b82f6");
  const [bgColor, setBgColor] = useState("#f8fafc");
  const [brushSize, setBrushSize] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [font, setFont] = useState("Arial");
  const [fontSize, setFontSize] = useState(18);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPath, setCurrentPath] = useState([]);
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [stickyText, setStickyText] = useState("");
  const [editingSticky, setEditingSticky] = useState(null);
  const [showLayers, setShowLayers] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState("stroke");
  const [customColor, setCustomColor] = useState("#000000");
  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState("png");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [rulers, setRulers] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [fillShape, setFillShape] = useState(false);
  const [lineStyle, setLineStyle] = useState("solid");
  const [arrowStart, setArrowStart] = useState(false);
  const [arrowEnd, setArrowEnd] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [zoom2, setZoom2] = useState(false);

  // init canvas size
  useEffect(() => {
    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setCanvasSize({ w, h });
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // redraw whenever elements / zoom / pan / grid / bg change
  useEffect(() => {
    redraw();
  }, [elements, zoom, pan, showGrid, gridSize, bgColor, darkMode, selected, rulers]);

  function snapVal(v) {
    if (!snapToGrid) return v;
    return Math.round(v / gridSize) * gridSize;
  }

  function toCanvas(clientX, clientY) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = snapVal((clientX - rect.left - pan.x) / zoom);
    const y = snapVal((clientY - rect.top - pan.y) / zoom);
    return { x, y };
  }

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvasSize.w || window.innerWidth;
    canvas.height = canvasSize.h || window.innerHeight;

    // background
    ctx.fillStyle = darkMode ? "#1e1e2e" : bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = darkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
      ctx.lineWidth = 0.5;
      const step = gridSize * zoom;
      const offX = pan.x % step;
      const offY = pan.y % step;
      for (let x = offX; x < canvas.width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = offY; y < canvas.height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
      ctx.restore();
    }

    // rulers
    if (rulers) drawRulers(ctx, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    elements.forEach(el => drawElement(ctx, el));

    // selection box
    if (selected !== null) {
      const el = elements.find(e => e.id === selected);
      if (el) drawSelection(ctx, el);
    }

    ctx.restore();
  }

  function drawRulers(ctx, W, H) {
    const step = 50 * zoom;
    ctx.save();
    ctx.fillStyle = darkMode ? "#2a2a3e" : "#f1f5f9";
    ctx.fillRect(0, 0, W, 20);
    ctx.fillRect(0, 0, 20, H);
    ctx.strokeStyle = darkMode ? "#444" : "#cbd5e1";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0, 0, W, 20);
    ctx.strokeRect(0, 0, 20, H);
    ctx.fillStyle = darkMode ? "#94a3b8" : "#64748b";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    for (let x = pan.x % step; x < W; x += step) {
      const val = Math.round((x - pan.x) / zoom);
      ctx.fillText(val, x, 14);
      ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, 20); ctx.strokeStyle = darkMode ? "#555" : "#94a3b8"; ctx.stroke();
    }
    ctx.textAlign = "left";
    for (let y = pan.y % step; y < H; y += step) {
      const val = Math.round((y - pan.y) / zoom);
      ctx.save(); ctx.translate(14, y); ctx.rotate(-Math.PI / 2);
      ctx.fillText(val, 0, 0); ctx.restore();
    }
    ctx.restore();
  }

  function applyStyle(ctx, el) {
    ctx.globalAlpha = el.opacity ?? 1;
    ctx.strokeStyle = el.color || "#000";
    ctx.lineWidth = el.size || 2;
    ctx.fillStyle = el.fillColor || "transparent";
    if (el.lineStyle === "dashed") ctx.setLineDash([el.size * 4, el.size * 2]);
    else if (el.lineStyle === "dotted") ctx.setLineDash([el.size, el.size * 2]);
    else ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function drawElement(ctx, el) {
    ctx.save();
    applyStyle(ctx, el);
    switch (el.type) {
      case "pen": {
        if (!el.points || el.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        el.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        break;
      }
      case "eraser": {
        if (!el.points || el.points.length < 2) break;
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        el.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineWidth = el.size * 3;
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      case "rect": {
        ctx.beginPath();
        ctx.rect(el.x, el.y, el.w, el.h);
        if (el.filled) ctx.fill();
        ctx.stroke();
        break;
      }
      case "circle": {
        ctx.beginPath();
        ctx.arc(el.x + el.w / 2, el.y + el.h / 2, Math.min(Math.abs(el.w), Math.abs(el.h)) / 2, 0, Math.PI * 2);
        if (el.filled) ctx.fill();
        ctx.stroke();
        break;
      }
      case "ellipse": {
        ctx.beginPath();
        ctx.ellipse(el.x + el.w / 2, el.y + el.h / 2, Math.abs(el.w) / 2, Math.abs(el.h) / 2, 0, 0, Math.PI * 2);
        if (el.filled) ctx.fill();
        ctx.stroke();
        break;
      }
      case "triangle": {
        ctx.beginPath();
        ctx.moveTo(el.x + el.w / 2, el.y);
        ctx.lineTo(el.x + el.w, el.y + el.h);
        ctx.lineTo(el.x, el.y + el.h);
        ctx.closePath();
        if (el.filled) ctx.fill();
        ctx.stroke();
        break;
      }
      case "line": {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + el.w, el.y + el.h);
        ctx.stroke();
        break;
      }
      case "arrow": {
        drawArrow(ctx, el);
        break;
      }
      case "text": {
        ctx.globalAlpha = el.opacity ?? 1;
        ctx.fillStyle = el.color;
        ctx.font = `${el.italic ? "italic " : ""}${el.bold ? "bold " : ""}${el.fontSize}px ${el.font}`;
        ctx.fillText(el.text, el.x, el.y + el.fontSize);
        break;
      }
      case "sticky": {
        const colors = { yellow: "#fef08a", blue: "#bfdbfe", green: "#bbf7d0", pink: "#fbcfe8", orange: "#fed7aa" };
        ctx.fillStyle = colors[el.stickyColor] || "#fef08a";
        ctx.globalAlpha = 0.95;
        roundRect(ctx, el.x, el.y, el.w, el.h, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1;
        roundRect(ctx, el.x, el.y, el.w, el.h, 6);
        ctx.stroke();
        ctx.fillStyle = "#1e293b";
        ctx.font = `${el.fontSize || 14}px ${el.font || "Arial"}`;
        wrapText(ctx, el.text, el.x + 10, el.y + 20, el.w - 20, (el.fontSize || 14) + 4);
        break;
      }
      case "image": {
        if (el._img) {
          ctx.globalAlpha = el.opacity ?? 1;
          ctx.drawImage(el._img, el.x, el.y, el.w, el.h);
        }
        break;
      }
    }
    ctx.restore();
  }

  function drawArrow(ctx, el) {
    const x1 = el.x, y1 = el.y, x2 = el.x + el.w, y2 = el.y + el.h;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const len = 12 + el.size * 2;
    if (el.arrowEnd !== false) {
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - len * Math.cos(angle - 0.4), y2 - len * Math.sin(angle - 0.4));
      ctx.lineTo(x2 - len * Math.cos(angle + 0.4), y2 - len * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = el.color;
      ctx.fill();
    }
    if (el.arrowStart) {
      const a2 = angle + Math.PI;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - len * Math.cos(a2 - 0.4), y1 - len * Math.sin(a2 - 0.4));
      ctx.lineTo(x1 - len * Math.cos(a2 + 0.4), y1 - len * Math.sin(a2 + 0.4));
      ctx.closePath();
      ctx.fillStyle = el.color;
      ctx.fill();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(" ");
    let line = "";
    let cy = y;
    words.forEach((w, i) => {
      const test = line + w + " ";
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, x, cy);
        line = w + " ";
        cy += lineH;
      } else line = test;
    });
    ctx.fillText(line, x, cy);
  }

  function drawSelection(ctx, el) {
    const bounds = getElementBounds(el);
    if (!bounds) return;
    const { x, y, w, h } = bounds;
    ctx.save();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(x - 4 / zoom, y - 4 / zoom, w + 8 / zoom, h + 8 / zoom);
    ctx.setLineDash([]);
    const handles = getResizeHandles(x, y, w, h);
    handles.forEach(([hx, hy]) => {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.arc(hx, hy, 5 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  function getElementBounds(el) {
    if (!el) return null;
    switch (el.type) {
      case "pen": case "eraser": {
        if (!el.points?.length) return null;
        const xs = el.points.map(p => p.x);
        const ys = el.points.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        return { x: minX, y: minY, w: maxX - minX || 1, h: maxY - minY || 1 };
      }
      case "text": {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.font = `${el.italic ? "italic " : ""}${el.bold ? "bold " : ""}${el.fontSize}px ${el.font}`;
        const tw = ctx.measureText(el.text).width;
        return { x: el.x, y: el.y, w: tw, h: el.fontSize };
      }
      default:
        return { x: Math.min(el.x, el.x + el.w), y: Math.min(el.y, el.y + el.h), w: Math.abs(el.w), h: Math.abs(el.h) };
    }
  }

  function getResizeHandles(x, y, w, h) {
    return [
      [x, y], [x + w / 2, y], [x + w, y],
      [x, y + h / 2], [x + w, y + h / 2],
      [x, y + h], [x + w / 2, y + h], [x + w, y + h]
    ];
  }

  function getHandleAtPoint(px, py, el) {
    const bounds = getElementBounds(el);
    if (!bounds) return null;
    const { x, y, w, h } = bounds;
    const handles = getResizeHandles(x, y, w, h);
    const names = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];
    const thresh = 8 / zoom;
    for (let i = 0; i < handles.length; i++) {
      const [hx, hy] = handles[i];
      if (Math.abs(px - hx) < thresh && Math.abs(py - hy) < thresh) return names[i];
    }
    return null;
  }

  function hitTest(px, py, el) {
    const b = getElementBounds(el);
    if (!b) return false;
    const pad = 8 / zoom;
    return px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
  }

  function pushHistory(newElements) {
    const next = history.slice(0, historyIdx + 1);
    next.push(newElements);
    if (next.length > HISTORY_LIMIT) next.shift();
    setHistory(next);
    setHistoryIdx(next.length - 1);
  }

  function undo() {
    if (historyIdx <= 0) return;
    const idx = historyIdx - 1;
    setHistoryIdx(idx);
    setElements(history[idx]);
    setSelected(null);
  }

  function redo() {
    if (historyIdx >= history.length - 1) return;
    const idx = historyIdx + 1;
    setHistoryIdx(idx);
    setElements(history[idx]);
  }

  function deleteSelected() {
    if (selected === null) return;
    const newEls = elements.filter(e => e.id !== selected);
    setElements(newEls);
    pushHistory(newEls);
    setSelected(null);
  }

  function duplicateSelected() {
    const el = elements.find(e => e.id === selected);
    if (!el) return;
    const clone = { ...el, id: generateId(), x: (el.x || 0) + 20, y: (el.y || 0) + 20 };
    if (el.points) clone.points = el.points.map(p => ({ x: p.x + 20, y: p.y + 20 }));
    const newEls = [...elements, clone];
    setElements(newEls);
    pushHistory(newEls);
    setSelected(clone.id);
  }

  function bringToFront() {
    const idx = elements.findIndex(e => e.id === selected);
    if (idx < 0) return;
    const arr = [...elements];
    const [el] = arr.splice(idx, 1);
    arr.push(el);
    setElements(arr);
    pushHistory(arr);
  }

  function sendToBack() {
    const idx = elements.findIndex(e => e.id === selected);
    if (idx < 0) return;
    const arr = [...elements];
    const [el] = arr.splice(idx, 1);
    arr.unshift(el);
    setElements(arr);
    pushHistory(arr);
  }

  function clearAll() {
    if (!window.confirm("Clear all elements?")) return;
    setElements([]);
    pushHistory([]);
    setSelected(null);
  }

  function floodFill(cx, cy, fillCol) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const px = Math.round(cx * zoom + pan.x);
    const py = Math.round(cy * zoom + pan.y);
    const W = canvas.width;
    const H = canvas.height;
    const idx = (py * W + px) * 4;
    const [tr, tg, tb, ta] = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
    const col = hexToRgb(fillCol);
    if (!col) return;
    const stack = [[px, py]];
    const visited = new Set();
    function matches(i) {
      return Math.abs(data[i] - tr) < 30 && Math.abs(data[i + 1] - tg) < 30 && Math.abs(data[i + 2] - tb) < 30;
    }
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const key = y * W + x;
      if (visited.has(key)) continue;
      visited.add(key);
      const i = (y * W + x) * 4;
      if (!matches(i)) continue;
      data[i] = col.r; data[i + 1] = col.g; data[i + 2] = col.b; data[i + 3] = 255;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null;
  }

  function eyedrop(clientX, clientY) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const ctx = canvas.getContext("2d");
    const d = ctx.getImageData(px, py, 1, 1).data;
    const hex = "#" + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, "0")).join("");
    setColor(hex);
    setCustomColor(hex);
    setTool("pen");
  }

  const onMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && tool === "zoom" && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }
    if (tool === "zoom") {
      if (e.shiftKey) setZoom(z => Math.max(0.1, z / 1.2));
      else setZoom(z => Math.min(5, z * 1.2));
      return;
    }
    const pos = toCanvas(e.clientX, e.clientY);

    if (tool === "fill") { floodFill(pos.x, pos.y, fillColor); return; }
    if (tool === "eyedropper") { eyedrop(e.clientX, e.clientY); return; }

    if (tool === "select") {
      // check resize handle
      if (selected !== null) {
        const el = elements.find(el => el.id === selected);
        if (el) {
          const h = getHandleAtPoint(pos.x, pos.y, el);
          if (h) {
            setResizing(true);
            setResizeHandle(h);
            setDragStart(pos);
            return;
          }
        }
      }
      // hit test
      const hit = [...elements].reverse().find(el => hitTest(pos.x, pos.y, el));
      if (hit) {
        setSelected(hit.id);
        setDragging(true);
        setDragStart(pos);
      } else {
        setSelected(null);
      }
      return;
    }

    setStartPos(pos);
    setDrawing(true);
    if (tool === "pen" || tool === "eraser") setCurrentPath([pos]);
    if (tool === "text") {
      const t = window.prompt("Enter text:");
      if (t) {
        const el = { id: generateId(), type: "text", x: pos.x, y: pos.y, text: t, color, font, fontSize, bold, italic, opacity };
        const newEls = [...elements, el];
        setElements(newEls);
        pushHistory(newEls);
      }
      setDrawing(false);
    }
    if (tool === "sticky") {
      const el = {
        id: generateId(), type: "sticky", x: pos.x, y: pos.y, w: 160, h: 140,
        text: "Double-click to edit", stickyColor: "yellow", font, fontSize: 13, opacity
      };
      const newEls = [...elements, el];
      setElements(newEls);
      pushHistory(newEls);
      setDrawing(false);
    }
  }, [tool, pan, zoom, elements, selected, color, font, fontSize, bold, italic, opacity, fillColor, lineStyle]);

  const onMouseMove = useCallback((e) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    if (!drawing && !dragging && !resizing) return;
    const pos = toCanvas(e.clientX, e.clientY);

    if (dragging && selected !== null) {
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      setElements(prev => prev.map(el => {
        if (el.id !== selected) return el;
        if (el.type === "pen" || el.type === "eraser") {
          return { ...el, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
        }
        return { ...el, x: el.x + dx, y: el.y + dy };
      }));
      setDragStart(pos);
      return;
    }

    if (resizing && selected !== null) {
      setElements(prev => prev.map(el => {
        if (el.id !== selected) return el;
        const b = getElementBounds(el);
        if (!b) return el;
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;
        let { x, y, w, h } = { x: el.x, y: el.y, w: el.w, h: el.h };
        const ew = b.w, eh = b.h;
        if (resizeHandle.includes("e")) w = ew + dx;
        if (resizeHandle.includes("s")) h = eh + dy;
        if (resizeHandle.includes("w")) { x += dx; w = ew - dx; }
        if (resizeHandle.includes("n")) { y += dy; h = eh - dy; }
        return { ...el, x, y, w, h };
      }));
      return;
    }

    if (!drawing) return;

    if (tool === "pen" || tool === "eraser") {
      setCurrentPath(prev => [...prev, pos]);
      // live draw
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = brushSize * 3;
      } else {
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const pts = [...currentPath, pos];
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [isPanning, panStart, drawing, dragging, resizing, selected, dragStart, tool, color, brushSize, opacity, zoom, pan, currentPath, resizeHandle]);

  const onMouseUp = useCallback((e) => {
    if (isPanning) { setIsPanning(false); return; }
    if (dragging) {
      setDragging(false);
      pushHistory([...elements]);
      return;
    }
    if (resizing) {
      setResizing(false);
      pushHistory([...elements]);
      return;
    }
    if (!drawing) return;
    const pos = toCanvas(e.clientX, e.clientY);
    let el = null;
    const base = { id: generateId(), color, size: brushSize, opacity, lineStyle };

    if (tool === "pen" || tool === "eraser") {
      const pts = [...currentPath, pos];
      if (pts.length < 2) { setDrawing(false); setCurrentPath([]); return; }
      el = { ...base, type: tool, points: pts };
    } else if (["rect", "circle", "ellipse", "triangle"].includes(tool)) {
      el = { ...base, type: tool, x: startPos.x, y: startPos.y, w: pos.x - startPos.x, h: pos.y - startPos.y, filled: fillShape, fillColor };
    } else if (tool === "line") {
      el = { ...base, type: "line", x: startPos.x, y: startPos.y, w: pos.x - startPos.x, h: pos.y - startPos.y };
    } else if (tool === "arrow") {
      el = { ...base, type: "arrow", x: startPos.x, y: startPos.y, w: pos.x - startPos.x, h: pos.y - startPos.y, arrowStart, arrowEnd };
    }

    if (el) {
      const newEls = [...elements, el];
      setElements(newEls);
      pushHistory(newEls);
    }
    setDrawing(false);
    setCurrentPath([]);
  }, [isPanning, dragging, resizing, drawing, tool, color, brushSize, opacity, lineStyle, fillShape, fillColor, startPos, currentPath, elements, arrowStart, arrowEnd]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const scale = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom(z => Math.min(5, Math.max(0.1, z * scale)));
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const key = e.key.toLowerCase();
      const shortcuts = {
        "p": "pen", "e": "eraser", "r": "rect", "c": "circle", "l": "line",
        "a": "arrow", "t": "text", "s": "select", "f": "fill", "z": "zoom",
        "i": "eyedropper", "n": "sticky"
      };
      if (shortcuts[key] && !e.ctrlKey && !e.metaKey) setTool(shortcuts[key]);
      if ((e.ctrlKey || e.metaKey) && key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && key === "y") { e.preventDefault(); redo(); }
      if (key === "delete" || key === "backspace") deleteSelected();
      if ((e.ctrlKey || e.metaKey) && key === "d") { e.preventDefault(); duplicateSelected(); }
      if ((e.ctrlKey || e.metaKey) && key === "a") { e.preventDefault(); /* select all */ }
      if (key === "escape") setSelected(null);
      if (key === "[") sendToBack();
      if (key === "]") bringToFront();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [elements, selected, historyIdx, history]);

  function addImageFiles(files) {
    const imageFiles = files.filter(file => file && file.type && file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      if (files.length > 0) alert("Please choose image files only.");
      return;
    }

    imageFiles.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const img = new Image();
        img.onload = () => {
          const safeWidth = img.width > 0 ? img.width : 100;
          const safeHeight = img.height > 0 ? img.height : 100;
          const scale = Math.min(300 / safeWidth, 300 / safeHeight, 1);
          const w = safeWidth * scale;
          const h = safeHeight * scale;
          const el = {
            id: generateId(), type: "image", x: 80 + i * 20, y: 80 + i * 20,
            w, h, src: dataUrl, _img: img, opacity
          };
          setElements(prev => {
            const newEls = [...prev, el];
            pushHistory(newEls);
            return newEls;
          });
        };
        img.onerror = () => {
          alert(`Could not load image: ${file.name}`);
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        alert(`Failed to read file: ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleImageUpload(e) {
    if (!e.target.files) return;
    addImageFiles(Array.from(e.target.files));
    e.target.value = "";
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      addImageFiles(Array.from(e.dataTransfer.files));
    }
  }

  

  function exportCanvas(format) {
    const canvas = canvasRef.current;
    if (format === "png") {
      const link = document.createElement("a");
      link.download = "whiteboard.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } else if (format === "jpg") {
      const link = document.createElement("a");
      link.download = "whiteboard.jpg";
      link.href = canvas.toDataURL("image/jpeg", 0.9);
      link.click();
    } else if (format === "svg") {
      alert("SVG export: Use PNG for now — full SVG coming soon.");
    } else if (format === "json") {
      const data = JSON.stringify(elements.map(el => {
        const { _img, ...rest } = el;
        return rest;
      }), null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const link = document.createElement("a");
      link.download = "whiteboard.json";
      link.href = URL.createObjectURL(blob);
      link.click();
    }
    setShowExport(false);
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const els = JSON.parse(reader.result);
        const loaded = els.map(el => {
          if (el.type === "image" && el.src) {
            const img = new Image();
            img.src = el.src;
            return { ...el, _img: img };
          }
          return el;
        });
        setElements(loaded);
        pushHistory(loaded);
      } catch { alert("Invalid JSON file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function onDoubleClick(e) {
    const pos = toCanvas(e.clientX, e.clientY);
    const hit = [...elements].reverse().find(el => el.type === "sticky" && hitTest(pos.x, pos.y, el));
    if (hit) {
      const t = window.prompt("Edit sticky note:", hit.text);
      if (t !== null) {
        const newEls = elements.map(el => el.id === hit.id ? { ...el, text: t } : el);
        setElements(newEls);
        pushHistory(newEls);
      }
    }
  }

  const toolIcons = {
    pen: "✏️", eraser: "🧹", rect: "▭", circle: "○", ellipse: "⬭", triangle: "△",
    line: "╱", arrow: "→", text: "T", sticky: "📝", select: "⬡", fill: "🪣",
    eyedropper: "🖱", zoom: "🔍"
  };

  const toolLabels = {
    pen: "Pen (P)", eraser: "Eraser (E)", rect: "Rectangle (R)", circle: "Circle (C)",
    ellipse: "Ellipse", triangle: "Triangle", line: "Line (L)", arrow: "Arrow (A)",
    text: "Text (T)", sticky: "Sticky Note (N)", select: "Select (S)", fill: "Fill (F)",
    eyedropper: "Eyedropper (I)", zoom: "Zoom (Z)"
  };

  const selectedEl = elements.find(e => e.id === selected);

  const ui = {
    bg: darkMode ? "#1a1a2e" : "#f8fafc",
    toolbar: darkMode ? "rgba(30,30,50,0.97)" : "rgba(255,255,255,0.97)",
    border: darkMode ? "#2d2d4a" : "#e2e8f0",
    text: darkMode ? "#e2e8f0" : "#1e293b",
    muted: darkMode ? "#64748b" : "#94a3b8",
    active: "#3b82f6",
    hover: darkMode ? "#2d2d4a" : "#f1f5f9",
  };

  const btnStyle = (active) => ({
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 36, height: 36, border: "none", borderRadius: 8, cursor: "pointer",
    background: active ? "#3b82f6" : "transparent",
    color: active ? "#fff" : ui.text,
    fontSize: 15, transition: "all 0.12s", position: "relative"
  });

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: ui.bg, fontFamily: "system-ui, sans-serif", userSelect: "none" }}>
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={onDoubleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ display: "block", cursor: { pen: "crosshair", eraser: "cell", select: "default", fill: "crosshair", eyedropper: "crosshair", zoom: "zoom-in", text: "text" }[tool] || "crosshair" }}
      />

      {/* Left toolbar */}
      <div style={{
        position: "fixed", left: 12, top: "50%", transform: "translateY(-50%)",
        background: ui.toolbar, border: `1px solid ${ui.border}`, borderRadius: 14,
        padding: "8px 6px", display: "flex", flexDirection: "column", gap: 2,
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)", zIndex: 100
      }}>
        {TOOLS.map(t => (
          <div key={t} style={{ position: "relative" }}>
            <button
              onClick={() => setTool(t)}
              style={btnStyle(tool === t)}
              title={toolLabels[t]}
            >
              <span style={{ fontSize: 14 }}>{toolIcons[t]}</span>
            </button>
          </div>
        ))}
        <div style={{ height: 1, background: ui.border, margin: "4px 0" }} />
        <button onClick={undo} style={btnStyle(false)} title="Undo (Ctrl+Z)">↩</button>
        <button onClick={redo} style={btnStyle(false)} title="Redo (Ctrl+Y)">↪</button>
      </div>

      {/* Top properties bar */}
      <div style={{
        position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
        background: ui.toolbar, border: `1px solid ${ui.border}`, borderRadius: 12,
        padding: "6px 12px", display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)", zIndex: 100, flexWrap: "wrap", maxWidth: "90vw"
      }}>
        {/* Stroke color */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, color: ui.muted }}>Stroke</span>
          <div style={{ position: "relative" }}>
            <div
              onClick={() => { setColorPickerTarget("stroke"); setShowColorPicker(p => !p); }}
              style={{ width: 24, height: 24, borderRadius: 6, background: color, border: "2px solid " + ui.border, cursor: "pointer" }}
            />
          </div>
        </div>

        {/* Fill */}
        {["rect", "circle", "ellipse", "triangle", "fill"].includes(tool) && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: ui.muted, cursor: "pointer" }}>
                <input type="checkbox" checked={fillShape} onChange={e => setFillShape(e.target.checked)} style={{ accentColor: "#3b82f6" }} />
                Fill
              </label>
              {(fillShape || tool === "fill") && (
                <div
                  onClick={() => { setColorPickerTarget("fill"); setShowColorPicker(p => !p); }}
                  style={{ width: 24, height: 24, borderRadius: 6, background: fillColor, border: "2px solid " + ui.border, cursor: "pointer" }}
                />
              )}
            </div>
          </>
        )}

        {/* Brush size */}
        {!["select", "fill", "eyedropper", "zoom", "sticky"].includes(tool) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: ui.muted }}>Size</span>
            <input type="range" min={1} max={30} value={brushSize} onChange={e => setBrushSize(+e.target.value)} style={{ width: 70 }} />
            <span style={{ fontSize: 12, color: ui.text, minWidth: 20 }}>{brushSize}</span>
          </div>
        )}

        {/* Opacity */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: ui.muted }}>Opacity</span>
          <input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={e => setOpacity(+e.target.value)} style={{ width: 60 }} />
          <span style={{ fontSize: 12, color: ui.text, minWidth: 28 }}>{Math.round(opacity * 100)}%</span>
        </div>

        {/* Line style */}
        {["pen", "rect", "circle", "ellipse", "triangle", "line", "arrow"].includes(tool) && (
          <select value={lineStyle} onChange={e => setLineStyle(e.target.value)}
            style={{ fontSize: 12, border: `1px solid ${ui.border}`, borderRadius: 6, padding: "2px 4px", background: ui.toolbar, color: ui.text }}>
            <option value="solid">— Solid</option>
            <option value="dashed">– Dashed</option>
            <option value="dotted">· Dotted</option>
          </select>
        )}

        {/* Arrow options */}
        {tool === "arrow" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: ui.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
              <input type="checkbox" checked={arrowStart} onChange={e => setArrowStart(e.target.checked)} style={{ accentColor: "#3b82f6" }} /> ←
            </label>
            <label style={{ fontSize: 11, color: ui.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
              <input type="checkbox" checked={arrowEnd} onChange={e => setArrowEnd(e.target.checked)} style={{ accentColor: "#3b82f6" }} /> →
            </label>
          </div>
        )}

        {/* Text options */}
        {["text", "sticky"].includes(tool) && (
          <>
            <select value={font} onChange={e => setFont(e.target.value)}
              style={{ fontSize: 12, border: `1px solid ${ui.border}`, borderRadius: 6, padding: "2px 4px", background: ui.toolbar, color: ui.text }}>
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="number" value={fontSize} min={8} max={96} onChange={e => setFontSize(+e.target.value)}
              style={{ width: 48, fontSize: 12, border: `1px solid ${ui.border}`, borderRadius: 6, padding: "2px 4px", background: ui.toolbar, color: ui.text }} />
            <button onClick={() => setBold(b => !b)} style={{ ...btnStyle(bold), width: 28, height: 28, fontWeight: "bold", fontSize: 13 }}>B</button>
            <button onClick={() => setItalic(b => !b)} style={{ ...btnStyle(italic), width: 28, height: 28, fontStyle: "italic", fontSize: 13 }}>I</button>
          </>
        )}

        {/* Selected element controls */}
        {selected && (
          <>
            <div style={{ width: 1, height: 24, background: ui.border }} />
            <button onClick={deleteSelected} style={{ ...btnStyle(false), fontSize: 11, width: "auto", padding: "0 8px", color: "#ef4444" }}>🗑 Delete</button>
            <button onClick={duplicateSelected} style={{ ...btnStyle(false), fontSize: 11, width: "auto", padding: "0 8px" }}>⎘ Dupe</button>
            <button onClick={bringToFront} style={{ ...btnStyle(false), fontSize: 11, width: "auto", padding: "0 8px" }}>↑ Front</button>
            <button onClick={sendToBack} style={{ ...btnStyle(false), fontSize: 11, width: "auto", padding: "0 8px" }}>↓ Back</button>
          </>
        )}
      </div>

      {/* Color picker popup */}
      {showColorPicker && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          background: ui.toolbar, border: `1px solid ${ui.border}`, borderRadius: 12,
          padding: 14, zIndex: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.18)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>{colorPickerTarget === "stroke" ? "Stroke" : "Fill"} Color</span>
            <button onClick={() => setShowColorPicker(false)} style={{ background: "none", border: "none", cursor: "pointer", color: ui.muted, fontSize: 16 }}>✕</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6, marginBottom: 10 }}>
            {COLORS.map(c => (
              <div key={c}
                onClick={() => { colorPickerTarget === "stroke" ? setColor(c) : setFillColor(c); setCustomColor(c); setShowColorPicker(false); }}
                style={{ width: 26, height: 26, borderRadius: 6, background: c, border: `2px solid ${(colorPickerTarget === "stroke" ? color : fillColor) === c ? "#3b82f6" : ui.border}`, cursor: "pointer" }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)}
              style={{ width: 36, height: 36, border: "none", padding: 0, cursor: "pointer", background: "none" }} />
            <input value={customColor} onChange={e => setCustomColor(e.target.value)}
              style={{ flex: 1, fontSize: 13, border: `1px solid ${ui.border}`, borderRadius: 6, padding: "4px 8px", background: ui.toolbar, color: ui.text }} />
            <button onClick={() => { colorPickerTarget === "stroke" ? setColor(customColor) : setFillColor(customColor); setShowColorPicker(false); }}
              style={{ padding: "4px 12px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Right sidebar */}
      <div style={{
        position: "fixed", right: 12, top: "50%", transform: "translateY(-50%)",
        background: ui.toolbar, border: `1px solid ${ui.border}`, borderRadius: 14,
        padding: "8px 6px", display: "flex", flexDirection: "column", gap: 2,
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)", zIndex: 100
      }}>
        <button onClick={() => setShowGrid(g => !g)} style={btnStyle(showGrid)} title="Toggle Grid">⊞</button>
        <button onClick={() => setSnapToGrid(s => !s)} style={btnStyle(snapToGrid)} title="Snap to Grid">⊹</button>
        <button onClick={() => setRulers(r => !r)} style={btnStyle(rulers)} title="Rulers">📏</button>
        <button onClick={() => setShowLayers(l => !l)} style={btnStyle(showLayers)} title="Layers">◧</button>
        <button onClick={() => setDarkMode(d => !d)} style={btnStyle(darkMode)} title="Dark Mode">◑</button>
        <div style={{ height: 1, background: ui.border, margin: "4px 0" }} />
        <button onClick={() => fileInputRef.current.click()} style={btnStyle(false)} title="Upload Image">🖼</button>
        <button onClick={() => setShowExport(true)} style={btnStyle(false)} title="Export">💾</button>
        <button onClick={clearAll} style={{ ...btnStyle(false), color: "#ef4444" }} title="Clear All">🗑</button>
        <button onClick={() => setShowShortcuts(s => !s)} style={btnStyle(showShortcuts)} title="Shortcuts">⌨</button>
        <div style={{ height: 1, background: ui.border, margin: "4px 0" }} />
        <button onClick={() => setZoom(z => Math.min(5, z * 1.2))} style={btnStyle(false)} title="Zoom In">+</button>
        <button onClick={() => setZoom(1)} style={{ ...btnStyle(false), fontSize: 10 }} title="Reset Zoom">{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom(z => Math.max(0.1, z / 1.2))} style={btnStyle(false)} title="Zoom Out">−</button>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImageUpload} />
      <input type="file" accept=".json" style={{ display: "none" }} id="importJson" onChange={importJSON} />

      {/* Layers panel */}
      {showLayers && (
        <div style={{
          position: "fixed", right: 64, top: "50%", transform: "translateY(-50%)",
          background: ui.toolbar, border: `1px solid ${ui.border}`, borderRadius: 12,
          padding: 12, width: 200, maxHeight: 400, overflowY: "auto",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)", zIndex: 150
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: ui.text, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            Layers <span style={{ cursor: "pointer", color: ui.muted }} onClick={() => setShowLayers(false)}>✕</span>
          </div>
          {[...elements].reverse().map((el, i) => (
            <div key={el.id}
              onClick={() => setSelected(el.id)}
              style={{
                padding: "6px 8px", borderRadius: 6, marginBottom: 2,
                background: el.id === selected ? "#3b82f620" : "transparent",
                border: `1px solid ${el.id === selected ? "#3b82f6" : "transparent"}`,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6
              }}>
              <span style={{ fontSize: 11 }}>{toolIcons[el.type] || "?"}</span>
              <span style={{ fontSize: 12, color: ui.text }}>{el.type}{el.text ? `: ${el.text.slice(0, 12)}` : ""}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: ui.muted }}>#{elements.length - i}</span>
            </div>
          ))}
          {elements.length === 0 && <span style={{ fontSize: 12, color: ui.muted }}>No layers yet</span>}
        </div>
      )}

      {/* Export panel */}
      {showExport && (
        <div style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          background: ui.toolbar, border: `1px solid ${ui.border}`, borderRadius: 14,
          padding: 20, width: 280, zIndex: 300, boxShadow: "0 8px 40px rgba(0,0,0,0.2)"
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: ui.text, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
            Export <span style={{ cursor: "pointer", color: ui.muted }} onClick={() => setShowExport(false)}>✕</span>
          </div>
          {["png", "jpg", "json"].map(f => (
            <button key={f} onClick={() => exportCanvas(f)}
              style={{ display: "block", width: "100%", padding: "8px 12px", marginBottom: 8, borderRadius: 8, border: `1px solid ${f === exportFormat ? "#3b82f6" : ui.border}`, background: f === exportFormat ? "#3b82f610" : "transparent", color: ui.text, cursor: "pointer", textAlign: "left", fontSize: 13 }}>
              {f === "png" ? "🖼 PNG Image" : f === "jpg" ? "📷 JPEG Image" : "📄 JSON (Project File)"}
            </button>
          ))}
          <div style={{ marginTop: 8, borderTop: `1px solid ${ui.border}`, paddingTop: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: ui.muted, cursor: "pointer" }}>
              <input type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
              <span onClick={() => document.getElementById("importJson").click()}>📂 Import JSON project</span>
            </label>
          </div>
        </div>
      )}

      {/* Background color + grid settings */}
      <div style={{
        position: "fixed", bottom: 12, right: 12,
        background: ui.toolbar, border: `1px solid ${ui.border}`, borderRadius: 10,
        padding: "6px 10px", display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)", zIndex: 100, fontSize: 12
      }}>
        <span style={{ color: ui.muted }}>Canvas:</span>
        <div
          onClick={() => { setColorPickerTarget("bg"); setShowColorPicker(true); }}
          style={{ width: 20, height: 20, borderRadius: 4, background: bgColor, border: `1px solid ${ui.border}`, cursor: "pointer" }}
        />
        <span style={{ color: ui.muted }}>Grid:</span>
        <input type="number" value={gridSize} min={5} max={100} onChange={e => setGridSize(+e.target.value)}
          style={{ width: 44, fontSize: 12, border: `1px solid ${ui.border}`, borderRadius: 5, padding: "2px 4px", background: ui.toolbar, color: ui.text }} />
        <span style={{ color: ui.muted }}>|</span>
        <span style={{ color: ui.text }}>{elements.length} obj</span>
        <span style={{ color: ui.muted }}>|</span>
        <span style={{ color: ui.text }}>{Math.round(zoom * 100)}%</span>
      </div>

      {/* Shortcuts panel */}
      {showShortcuts && (
        <div style={{
          position: "fixed", bottom: 60, right: 64,
          background: ui.toolbar, border: `1px solid ${ui.border}`, borderRadius: 12,
          padding: 14, width: 220, zIndex: 200, boxShadow: "0 4px 24px rgba(0,0,0,0.15)", fontSize: 12
        }}>
          <div style={{ fontWeight: 600, color: ui.text, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            Shortcuts <span style={{ cursor: "pointer", color: ui.muted }} onClick={() => setShowShortcuts(false)}>✕</span>
          </div>
          {[
            ["P", "Pen"], ["E", "Eraser"], ["R", "Rectangle"], ["C", "Circle"],
            ["L", "Line"], ["A", "Arrow"], ["T", "Text"], ["S", "Select"],
            ["F", "Fill"], ["Z", "Zoom"], ["N", "Sticky"], ["I", "Eyedropper"],
            ["Ctrl+Z", "Undo"], ["Ctrl+Y", "Redo"],
            ["Del", "Delete selected"], ["Ctrl+D", "Duplicate"],
            ["[", "Send back"], ["]", "Bring front"],
            ["Esc", "Deselect"], ["Scroll", "Pan"],
            ["Ctrl+Scroll", "Zoom"], ["Middle click", "Pan"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: `1px solid ${ui.border}20` }}>
              <code style={{ fontSize: 11, background: ui.hover, padding: "1px 5px", borderRadius: 4, color: ui.text }}>{k}</code>
              <span style={{ color: ui.muted }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sticky color picker when sticky is selected */}
      {selectedEl?.type === "sticky" && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          background: ui.toolbar, border: `1px solid ${ui.border}`, borderRadius: 10,
          padding: "6px 12px", display: "flex", gap: 8, alignItems: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.1)", zIndex: 150
        }}>
          <span style={{ fontSize: 12, color: ui.muted }}>Note color:</span>
          {[["yellow","#fef08a"],["blue","#bfdbfe"],["green","#bbf7d0"],["pink","#fbcfe8"],["orange","#fed7aa"]].map(([name, hex]) => (
            <div key={name}
              onClick={() => {
                const newEls = elements.map(el => el.id === selected ? { ...el, stickyColor: name } : el);
                setElements(newEls); pushHistory(newEls);
              }}
              style={{ width: 22, height: 22, borderRadius: 5, background: hex, border: `2px solid ${selectedEl.stickyColor === name ? "#3b82f6" : ui.border}`, cursor: "pointer" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}