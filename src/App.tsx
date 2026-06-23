import React, { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import { motion, AnimatePresence } from "motion/react";
import {
  Download,
  Upload,
  Sparkles,
  RefreshCw,
  Check,
  Copy,
  Plus,
  Users,
  Trash2,
  AlertCircle,
  FileText,
  CheckCircle,
  Image as ImageIcon,
  FileArchive,
  HelpCircle,
  Info,
  Layers,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { drawInvitation } from "./utils/canvasRenderer";
import { GuestInvitation, AICaptionOption } from "./types";

export default function App() {
  // General UI States
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");
  const [mobileActiveView, setMobileActiveView] = useState<"edit" | "preview">("edit");
  const [guestName, setGuestName] = useState("Kumar Dulal");
  const [bulkText, setBulkText] = useState(
    "Kumar Dulal\nRam Bahadur\nSita Sharma\nAashish Adhikari\nPrabin Shrestha\nMelina Rai"
  );
  
  // Custom font styling options
  const [fontFamily, setFontFamily] = useState("Great Vibes");
  const [fontSize, setFontSize] = useState(64);
  const [yOffset, setYOffset] = useState(145);
  const [xOffset, setXOffset] = useState(-114);

  // Custom template background upload (loads customized, or defaults to the original.svg)
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Drag and drop interactive states for Lettering Studio
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offsetsStart, setOffsetsStart] = useState({ x: 0, y: 0 });
  const [fontSizeStart, setFontSizeStart] = useState(64);
  const [hoverPosition, setHoverPosition] = useState<"text" | "handle" | null>(null);

  // Load server-side template status on boot
  useEffect(() => {
    fetch("/api/template-status")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.exists && data.url) {
          setCustomBackground(data.url);
        } else {
          // Check localStorage as local fallback
          try {
            const localBg = localStorage.getItem("ccube_custom_background");
            if (localBg) setCustomBackground(localBg);
          } catch (e) {}
        }
      })
      .catch((err) => {
        console.warn("Failed to check server template status, loading localStorage fallback:", err);
        try {
          const localBg = localStorage.getItem("ccube_custom_background");
          if (localBg) setCustomBackground(localBg);
        } catch (e) {}
      });
  }, []);

  const handleUploadBackground = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        // Upload base64 dynamically to express backend to save inside /assets/template.png
        const response = await fetch("/api/upload-template", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: dataUrl }),
        });

        const data = await response.json();
        if (data.success && data.url) {
          setCustomBackground(dataUrl);
          try {
            localStorage.setItem("ccube_custom_background", dataUrl);
          } catch (err) {
            console.warn("localStorage quota exceeded for raw image data, relying solely on server URL.");
          }
        } else {
          throw new Error(data.error || "Failed to save template on the server.");
        }
      } catch (err: any) {
        console.error("Template server sync failed:", err);
        setUploadError(err.message || "Failed to sync image with server assets, using browser-local mode.");
        setCustomBackground(dataUrl);
        try {
          localStorage.setItem("ccube_custom_background", dataUrl);
        } catch (e) {}
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearBackground = () => {
    setCustomBackground(null);
    try {
      localStorage.removeItem("ccube_custom_background");
    } catch (err) {
      console.warn("localStorage removeItem error:", err);
    }
  };

  // Bulk state
  const [bulkList, setBulkList] = useState<GuestInvitation[]>([]);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  // AI Caption states
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiCaptions, setAiCaptions] = useState<AICaptionOption[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // References
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenBulkCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fast tag selectors
  const fastSuggestions = [
    "Kumar Dulal",
    "Ram Bahadur",
    "Sita Sharma",
    "Aashish Adhikari",
    "Kamala Thapa",
    "Rajesh Hamal",
  ];

  // Auto file name formatting
  const getSaveFileName = (name: string): string => {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "") // remove special chars
      .replace(/\s+/g, "-");       // replace space with hyphens
    return `ccube-invites-you-${slug || "guest"}.png`;
  };

  // Coordinate transform mapping tool for Canvas Mouse/Touch Events
  const getCanvasCoords = (e: any) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    
    if (e.touches) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Map 0-1 percentage location back to the Canvas design area resolution (1200x1680)
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  // Check cursor distance to text bounding box & bottom-right drag resize point
  const checkHoverPosition = (canvasX: number, canvasY: number) => {
    const defaultCenterX = 695;
    const defaultCenterY = 770;
    const textX = defaultCenterX + xOffset;
    const textY = defaultCenterY + yOffset;

    const canvas = previewCanvasRef.current;
    let textWidth = (guestName || "Sample Guest").length * fontSize * 0.45;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.save();
        let fontSuffix = "cursive";
        if (fontFamily === "Playfair Display") fontSuffix = "serif";
        else if (fontFamily === "Montserrat") fontSuffix = "sans-serif";
        else if (fontFamily === "JetBrains Mono") fontSuffix = "monospace";
        ctx.font = `500 ${fontSize}px '${fontFamily}', ${fontSuffix}`;
        textWidth = ctx.measureText(guestName || "Sample Guest").width || textWidth;
        ctx.restore();
      }
    }

    const halfWidth = textWidth / 2;
    const padding = 20;
    const left = textX - halfWidth - padding;
    const right = textX + halfWidth + padding;
    const top = textY - fontSize - padding / 2;
    const bottom = textY + padding;

    // Is it close to the bottom-right corner point? (Gold resize handle)
    const distToHandle = Math.sqrt(Math.pow(canvasX - right, 2) + Math.pow(canvasY - bottom, 2));
    if (distToHandle < 36) { // Generous handle radius for ease of use
      return "handle";
    }

    // Is it inside the text bounding box?
    if (canvasX >= left && canvasX <= right && canvasY >= top && canvasY <= bottom) {
      return "text";
    }

    return null;
  };

  // Draw the luxury golden bounding box guides for dragging and resizing
  const drawInteractiveOverlay = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const defaultCenterX = 695;
    const defaultCenterY = 770;
    const textX = defaultCenterX + xOffset;
    const textY = defaultCenterY + yOffset;

    ctx.save();
    let fontSuffix = "cursive";
    if (fontFamily === "Playfair Display") fontSuffix = "serif";
    else if (fontFamily === "Montserrat") fontSuffix = "sans-serif";
    else if (fontFamily === "JetBrains Mono") fontSuffix = "monospace";
    ctx.font = `500 ${fontSize}px '${fontFamily}', ${fontSuffix}`;
    ctx.textAlign = "center";
    
    const textWidth = ctx.measureText(guestName || "Sample Guest Name").width || 200;
    ctx.restore();

    const halfWidth = textWidth / 2;
    const padding = 20;
    const left = textX - halfWidth - padding;
    const right = textX + halfWidth + padding;
    const top = textY - fontSize - padding / 2;
    const bottom = textY + padding;

    // Background selection shade
    ctx.save();
    ctx.fillStyle = "rgba(181, 130, 74, 0.04)";
    ctx.fillRect(left, top, right - left, bottom - top);

    // Golden dashed line guide
    ctx.strokeStyle = "#ab824a";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.strokeRect(left, top, right - left, bottom - top);
    ctx.restore();

    // Corner circles
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#4a2614";
    ctx.lineWidth = 2.5;

    const drawPoint = (cx: number, cy: number, active: boolean) => {
      ctx.beginPath();
      ctx.arc(cx, cy, active ? 13 : 7, 0, Math.PI * 2);
      ctx.fillStyle = active ? "#ab824a" : "#ffffff";
      ctx.fill();
      ctx.stroke();
      if (active) {
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    };

    drawPoint(left, top, false);
    drawPoint(right, top, false);
    drawPoint(left, bottom, false);
    
    // Bottom-right active Resize studio handle
    drawPoint(right, bottom, hoverPosition === "handle" || isResizing);
  };

  // Mouse Interactivity Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const hover = checkHoverPosition(coords.x, coords.y);
    if (hover === "handle") {
      setIsResizing(true);
      setDragStart({ x: coords.x, y: coords.y });
      setFontSizeStart(fontSize);
    } else if (hover === "text") {
      setIsDragging(true);
      setDragStart({ x: coords.x, y: coords.y });
      setOffsetsStart({ x: xOffset, y: yOffset });
    } else {
      // Direct click repositioning (Click anywhere to instantly relocate center and tune!)
      const defaultCenterX = 695;
      const defaultCenterY = 770;
      const exactX = Math.round(coords.x - defaultCenterX);
      const exactY = Math.round(coords.y - defaultCenterY);
      
      setXOffset(exactX);
      setYOffset(exactY);
      
      setIsDragging(true);
      setDragStart({ x: coords.x, y: coords.y });
      setOffsetsStart({ x: exactX, y: exactY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (isDragging) {
      const dx = coords.x - dragStart.x;
      const dy = coords.y - dragStart.y;
      setXOffset(Math.round(offsetsStart.x + dx));
      setYOffset(Math.round(offsetsStart.y + dy));
    } else if (isResizing) {
      const dx = coords.x - dragStart.x;
      const newSize = Math.max(16, Math.min(220, Math.round(fontSizeStart + dx * 0.45)));
      setFontSize(newSize);
    } else {
      const hover = checkHoverPosition(coords.x, coords.y);
      setHoverPosition(hover);
      
      const canvas = previewCanvasRef.current;
      if (canvas) {
        if (hover === "handle") {
          canvas.style.cursor = "nwse-resize";
        } else if (hover === "text") {
          canvas.style.cursor = "move";
        } else {
          canvas.style.cursor = "crosshair";
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Touch handlers (Painless drag/drop design on iPad, mobile screens)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const hover = checkHoverPosition(coords.x, coords.y);
    if (hover === "handle") {
      setIsResizing(true);
      setDragStart({ x: coords.x, y: coords.y });
      setFontSizeStart(fontSize);
    } else if (hover === "text") {
      setIsDragging(true);
      setDragStart({ x: coords.x, y: coords.y });
      setOffsetsStart({ x: xOffset, y: yOffset });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (isDragging) {
      e.preventDefault(); // Prevent page bouncing while positioning names
      const dx = coords.x - dragStart.x;
      const dy = coords.y - dragStart.y;
      setXOffset(Math.round(offsetsStart.x + dx));
      setYOffset(Math.round(offsetsStart.y + dy));
    } else if (isResizing) {
      e.preventDefault();
      const dx = coords.x - dragStart.x;
      const newSize = Math.max(16, Math.min(220, Math.round(fontSizeStart + dx * 0.45)));
      setFontSize(newSize);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // 1. Redraw immediately upon any changes, compiling and overlaying designer guidelines
  useEffect(() => {
    if (activeTab === "single" && previewCanvasRef.current) {
      drawInvitation(previewCanvasRef.current, guestName, {
        fontFamily,
        fontSize,
        yOffset,
        xOffset,
        customBackground,
      }, () => {
        // Overlay Lettering Studio bounding guidelines ONLY on the interactive preview!
        drawInteractiveOverlay();
      });
    }
  }, [
    guestName,
    fontFamily,
    fontSize,
    yOffset,
    xOffset,
    customBackground,
    activeTab,
    isDragging,
    isResizing,
    hoverPosition,
  ]);

  // Tab switcher redrawing effect
  useEffect(() => {
    if (previewCanvasRef.current) {
      drawInvitation(
        previewCanvasRef.current,
        activeTab === "single" ? guestName : "Sample Guest Name",
        {
          fontFamily,
          fontSize,
          yOffset,
          xOffset,
          customBackground,
        },
        () => {
          if (activeTab === "single") {
            drawInteractiveOverlay();
          }
        }
      );
    }
  }, [activeTab, customBackground]);

  // Redraw when Fonts are fully loaded to prevent browser rendering state flicker
  useEffect(() => {
    if (typeof document !== "undefined" && (document as any).fonts) {
      (document as any).fonts.ready.then(() => {
        if (previewCanvasRef.current) {
          drawInvitation(
            previewCanvasRef.current,
            activeTab === "single" ? guestName : "Sample Guest Name",
            {
              fontFamily,
              fontSize,
              yOffset,
              xOffset,
              customBackground,
            },
            () => {
              if (activeTab === "single") {
                drawInteractiveOverlay();
              }
            }
          );
        }
      });
    }
  }, [fontFamily, fontSize, yOffset, xOffset, customBackground]);

  // 2. STAGGERED BULK GENERATION ENGINE
  const handleGenerateBulk = async () => {
    if (isBulkGenerating) return;

    const names = bulkText
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) {
      alert("Please paste or type at least one name to generate.");
      return;
    }

    setIsBulkGenerating(true);
    setBulkProgress(0);

    const initialList: GuestInvitation[] = names.map((name, index) => ({
      id: `${index}-${Date.now()}`,
      name,
      status: "idle",
      fileName: getSaveFileName(name),
    }));
    setBulkList(initialList);

    const bulkCanvas = hiddenBulkCanvasRef.current;
    if (!bulkCanvas) {
      setIsBulkGenerating(false);
      return;
    }

    let progressCount = 0;
    
    for (let i = 0; i < initialList.length; i++) {
      setBulkList((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: "generating" } : item))
      );

      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 80));

      try {
        // Draw each bulk invitation using clean template (absolutely no drag & resize bounding overlays)
        await drawInvitation(bulkCanvas, initialList[i].name, {
          fontFamily,
          fontSize,
          yOffset,
          xOffset,
          customBackground,
        });

        const dataUrl = bulkCanvas.toDataURL("image/png");

        setBulkList((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "completed", dataUrl } : item
          )
        );
      } catch (err) {
        console.error("Render failed for name: " + initialList[i].name, err);
        setBulkList((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: "failed" } : item))
        );
      }

      progressCount++;
      setBulkProgress(Math.floor((progressCount / initialList.length) * 100));
    }

    setIsBulkGenerating(false);
  };

  // 3. SINGLE PNG DOWNLOAD (Pristine clean PNG export without design grids / overlays)
  const handleDownloadSingle = () => {
    try {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 1200;
      tempCanvas.height = 1680;

      drawInvitation(
        tempCanvas,
        guestName,
        {
          fontFamily,
          fontSize,
          yOffset,
          xOffset,
          customBackground,
        },
        () => {
          try {
            const dataUrl = tempCanvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = dataUrl;
            downloadLink.download = getSaveFileName(guestName);
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
          } catch (innerErr) {
            console.error("Failed to generate data URL from temporary canvas:", innerErr);
          }
        }
      );
    } catch (err) {
      console.error("Failed to compile temporary canvas:", err);
    }
  };

  // 4. DOWNLOADING INDIVIDUAL PNG IN BULK LIST
  const downloadIndividualFromList = (item: GuestInvitation) => {
    if (!item.dataUrl) return;
    const downloadLink = document.createElement("a");
    downloadLink.href = item.dataUrl;
    downloadLink.download = item.fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // 5. ZIP BULK ARCHIVE DOWNLOAD
  const handleDownloadAllZip = async () => {
    const completedItems = bulkList.filter((x) => x.status === "completed" && x.dataUrl);
    if (completedItems.length === 0) {
      alert("No successfully generated invitations to ZIP. Generate some cards first!");
      return;
    }

    const zip = new JSZip();
    
    completedItems.forEach((item) => {
      if (item.dataUrl) {
        // Remove data URL prefix (e.g. "data:image/png;base64,")
        const base64Data = item.dataUrl.split(",")[1];
        zip.file(item.fileName, base64Data, { base64: true });
      }
    });

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = zipUrl;
      downloadLink.download = "ccube-invitations-archive.zip";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(zipUrl);
    } catch (err) {
      console.error("Failed to compile ZIP archive:", err);
      alert("An error occurred compile ZIP: " + err);
    }
  };

  // 6. DOWNLOADING ALL INDIVIDUALLY (TRIGGER AUTOMATIC SEQUENTIAL DOWNLOADS)
  const handleDownloadAllAsPngs = () => {
    const completedItems = bulkList.filter((x) => x.status === "completed" && x.dataUrl);
    if (completedItems.length === 0) {
      alert("No generated invitations to download.");
      return;
    }
    
    // Warn user if downloading too many at once
    if (completedItems.length > 15) {
      const confirmDownload = confirm(
        `Are you sure you want to download ${completedItems.length} images individually? Your browser may prompt you to allow multiple file downlods.`
      );
      if (!confirmDownload) return;
    }

    completedItems.forEach((item, idx) => {
      setTimeout(() => {
        downloadIndividualFromList(item);
      }, idx * 250); // space downloads to avoid browser blockages
    });
  };

  // 7. GEMINI AI CAPTION GENERATOR
  const fetchAICaptions = async () => {
    setIsAiLoading(true);
    setAiError(null);
    setAiCaptions([]);

    try {
      const response = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName: activeTab === "single" ? guestName : "" }),
      });

      const data = await response.json();
      if (data.success && Array.isArray(data.captions)) {
        setAiCaptions(data.captions);
      } else {
        throw new Error(data.error || "Failed to receive valid captions.");
      }
    } catch (err: any) {
      console.error("Failed fetching AI response:", err);
      setAiError("AI caption generation is currently unavailable.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // 1-Click Copy helper
  const copyCaptionToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 1800);
  };

  // Populate list with standard sample input if user triggers it
  const loadExampleList = () => {
    setBulkText("Kumar Dulal\nRam Bahadur\nSita Sharma\nAashish Adhikari\nPrabin Shrestha\nMelina Rai\nGita Adhikari\nHari Prasad");
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] flex flex-col antialiased">
      {/* 1. BRAND NAVIGATION HEADER */}
      <nav id="navbar_brand" className="border-b border-[#eaddca] bg-[#fbf9f4]/95 px-6 py-3.5 sticky top-0 z-40 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Minimal programmatic icon logo */}
            <div className="w-10 h-10 rounded-xl bg-[#4a2614] flex items-center justify-center text-white font-serif font-bold text-lg shadow-md shrink-0">
              C³
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold font-serif text-[#4e2c14] tracking-tight leading-none">C Cube Studio</h1>
                <span className="text-[10px] font-bold text-[#274f17] bg-[#274f17]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Live Edition
                </span>
              </div>
              <p className="text-[10px] text-[#a17145] font-semibold tracking-wide mt-1">
                GRAND OPENING &bull; SINDHULI, NEPAL
              </p>
            </div>
          </div>
          
          {/* Top Navigation Links (App Tab Switchers) */}
          <div className="flex items-center bg-[#f0e6d6] p-1 rounded-xl border border-[#ebdcb9] w-full md:w-auto">
            <button
              onClick={() => {
                setActiveTab("single");
                setMobileActiveView("edit");
              }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "single"
                  ? "bg-[#4a2614] text-white shadow-sm scale-[1.01]"
                  : "text-[#5d4037] hover:bg-[#e4d6c1] hover:text-[#3e2723]"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Single Creator
            </button>
            <button
              onClick={() => {
                setActiveTab("bulk");
                setMobileActiveView("edit");
              }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "bulk"
                  ? "bg-[#4a2614] text-white shadow-sm scale-[1.01]"
                  : "text-[#5d4037] hover:bg-[#e4d6c1] hover:text-[#3e2723]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Bulk Generator
            </button>
          </div>

          {/* Location and Live Indicators */}
          <div className="hidden md:flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#274f17]/10 text-[#274f17]">
              <span className="w-2 h-2 rounded-full bg-[#274f17] animate-pulse"></span>
              Kamalamai-5, Sindhuli
            </span>
          </div>
        </div>
      </nav>

      {/* 2. CORE WORKSPACE */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 pb-24 md:pb-8">
        
        {/* LEFT COLUMN: CONTROLS & GENERATOR INTERFACES (SPAN 7) */}
        <div id="controls_panel" className={`lg:col-span-7 flex-col gap-6 ${mobileActiveView === "edit" ? "flex" : "hidden lg:flex"}`}>

          {/* MASTER INVITATION CARD TEMPLATE */}
          <div className="bg-white border border-[#ebdcb9] rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-bold text-[#4a2614] flex items-center gap-2 uppercase tracking-wide">
                <ImageIcon className="w-5 h-5 text-[#b58742]" />
                1. Original Invitation Template Setup
              </h3>
              <p className="text-xs text-[#5d4037] leading-relaxed">
                Upload your master original high-definition invitation card. This application acts as a high-fidelity Photoshop engine, preserving 100% of your graphics, coordinates, and branding, while overlaying dynamic guest names in the exact designated slot.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <label
                className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                  customBackground
                    ? "bg-[#274f17] text-white border-[#274f17] shadow-sm"
                    : "bg-[#faf8f5] border-[#eaddca] text-[#5d4037] hover:bg-[#faf6ee] hover:border-[#bcaaa4]"
                } ${isUploading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isUploading 
                  ? "Saving Master to Server..." 
                  : customBackground 
                    ? "✓ Original Template Locked & Saved" 
                    : "Upload Your Original Invitation Card Image"}
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploading}
                  onChange={handleUploadBackground}
                  className="hidden"
                />
              </label>

              {customBackground && (
                <button
                  type="button"
                  onClick={handleClearBackground}
                  className="text-xs font-bold text-red-600 hover:text-red-800 transition-all bg-red-50 border border-red-200/50 py-2.5 px-4 rounded-xl hover:bg-red-100/50 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Remove Custom Template & Reset to Default Guide
                </button>
              )}
            </div>

            {uploadError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 font-medium">
                ⚠️ {uploadError}
              </div>
            )}

            {customBackground ? (
              <div className="flex flex-col gap-2 bg-[#274f17]/5 border border-[#274f17]/25 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2 text-[#274f17] text-xs">
                  <CheckCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">100% Original Design Preserved!</span>
                    <span className="text-[11px] text-[#426a31] block mt-1 leading-relaxed">
                      All graphics, text layers, dates, and venue details are strictly locked. Adjust font styles and offsets below to overlap the guest slot with pixel-perfect Photoshop calibration.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-[#a17145] italic bg-[#faf8f5] border border-[#ebdcb9]/40 rounded-xl px-4 py-3 leading-relaxed">
                📢 Please upload your design. The app works like an exact batch overlay, so only the dynamic guest name field is modified.
              </div>
            )}
          </div>

          {/* DYNAMIC CONTENT PER SELECTED TAB */}
          <div className="bg-white border border-[#eaddca] rounded-2xl p-6 shadow-sm flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[#ebdcb9] justify-between">
              <span className="text-xs font-bold text-[#b58742] uppercase tracking-wider flex items-center gap-1.5">
                {activeTab === "single" ? (
                  <>
                    <FileText className="w-4 h-4" />
                    Step 2: Customizing Single Invitation Name
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    Step 2: Customizing Bulk Dataset
                  </>
                )}
              </span>
              <span className="text-[10px] font-bold text-[#274f17] bg-[#274f17]/10 px-2 py-0.5 rounded">
                Interactive Studio
              </span>
            </div>
            <AnimatePresence mode="wait">
              
              {/* TAB 1: SINGLE INVITATION GENERATOR */}
              {activeTab === "single" && (
                <motion.div
                  key="single_tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-6"
                >
                  <div className="flex flex-col gap-2">
                    <label htmlFor="guest_name_input" className="text-sm font-bold text-[#4a2614] flex items-center justify-between">
                      <span>GUEST FULL NAME:</span>
                      <button
                        type="button"
                        onClick={() => setMobileActiveView("preview")}
                        className="lg:hidden text-xs font-bold text-[#b58742] hover:text-[#4a2614] flex items-center gap-1 bg-[#b58742]/10 px-2.5 py-1 rounded"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-[#b58742]" />
                        View Live Preview
                      </button>
                      <span className="hidden lg:inline text-xs text-[#a17145] font-normal italic">
                        Updates automatically below
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        id="guest_name_input"
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="e.g. Kumar Dulal"
                        className="w-full text-base font-semibold px-4 py-3.5 bg-[#fdfdfc] border-2 border-[#e6dcce] rounded-xl text-[#3e2723] placeholder-[#bcaaa4] focus:outline-none focus:border-[#4a2614] transition-colors"
                      />
                    </div>
                  </div>

                  {/* SIGNATURE STYLE CONTROLS */}
                  <div className="bg-[#FAF8F5] border border-[#efe6db] rounded-xl p-4 flex flex-col gap-4">
                    <h4 className="text-xs font-bold text-[#4a2614] flex items-center gap-1.5 border-b border-[#ebdcb9] pb-2 uppercase tracking-wide">
                      <Sparkles className="w-3.5 h-3.5 text-[#b58742]" />
                      Signature Lettering Studio:
                    </h4>
                    
                    {/* Font selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#5d4037]">FONT FAMILY STYLE:</label>
                        <select
                          value={fontFamily}
                          onChange={(e) => setFontFamily(e.target.value)}
                          className="w-full text-xs font-semibold px-2.5 py-2 bg-white border border-[#eaddca] rounded-lg text-[#3e2723]"
                        >
                          <option value="Great Vibes">Great Vibes (Luxury Cursive)</option>
                          <option value="Playball">Playball (Dynamic Script)</option>
                          <option value="Alex Brush">Alex Brush (Fine Calligraphy)</option>
                          <option value="Playfair Display">Playfair Display (Serif Elegance)</option>
                          <option value="Montserrat">Montserrat (Clean Modern)</option>
                          <option value="JetBrains Mono">JetBrains Mono (Technical)</option>
                        </select>
                      </div>

                      {/* Font dimension slider */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs font-bold text-[#5d4037]">
                          <label>FONT SCALE SIZE:</label>
                          <span className="font-mono text-[#a17145] text-[11px]">{fontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="36"
                          max="92"
                          value={fontSize}
                          onChange={(e) => setFontSize(Number(e.target.value))}
                          className="w-full accent-[#4a2614]"
                        />
                      </div>
                    </div>

                    {/* Position and alignment offsets */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Height positioning slider */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs font-bold text-[#5d4037]">
                          <label className="flex items-center gap-1">
                            VERTICAL OFFSET (Y):
                            <span className="text-[10px] text-[#a17145] font-normal italic">(Up & Down)</span>
                          </label>
                          <span className="font-mono text-[#a17145] text-[11px]">{yOffset > 0 ? `+${yOffset}` : yOffset}px</span>
                        </div>
                        <input
                          type="range"
                          min="-150"
                          max="150"
                          value={yOffset}
                          onChange={(e) => setYOffset(Number(e.target.value))}
                          className="w-full accent-[#4a2614]"
                        />
                      </div>

                      {/* X-position slider */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs font-bold text-[#5d4037]">
                          <label className="flex items-center gap-1">
                            HORIZONTAL OFFSET (X):
                            <span className="text-[10px] text-[#a17145] font-normal italic">(Left & Right)</span>
                          </label>
                          <span className="font-mono text-[#a17145] text-[11px]">{xOffset > 0 ? `+${xOffset}` : xOffset}px</span>
                        </div>
                        <input
                          type="range"
                          min="-150"
                          max="150"
                          value={xOffset}
                          onChange={(e) => setXOffset(Number(e.target.value))}
                          className="w-full accent-[#4a2614]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* QUICK SUGGESTIONS CARDS */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-xs font-bold text-[#a17145] tracking-wider uppercase">
                      QUICK SUGGESTED NAMES:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {fastSuggestions.map((name, i) => (
                        <button
                          key={i}
                          onClick={() => setGuestName(name)}
                          className={`text-xs px-3 py-2 rounded-lg font-semibold border transition-all ${
                            guestName === name
                              ? "bg-[#fcf5ea] border-[#4a2614] text-[#4a2614] font-bold"
                              : "bg-[#fcfbf9] border-[#eaddca] text-[#5d4037] hover:border-[#bcaaa4] hover:bg-[#faf6ee]"
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* OUTLINE FILE NAME PREVIEW CONTAINER */}
                  <div className="text-xs text-[#a17145] flex items-center justify-between bg-[#faf8f5] px-4 py-2.5 rounded-xl border border-[#efe6db]">
                    <span className="font-bold uppercase tracking-wider text-[10px]">Saved File Name:</span>
                    <span className="font-bold text-[#4a2614] truncate max-w-[260px] font-mono" title={getSaveFileName(guestName)}>
                      {getSaveFileName(guestName)}
                    </span>
                  </div>

                  {/* DOWNLOAD CONTROL */}
                  <button
                    id="btn_download_single"
                    onClick={handleDownloadSingle}
                    className="w-full bg-[#4a2614] text-white hover:bg-[#341b0e] py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all duration-300 hover:shadow-lg active:scale-[0.99]"
                  >
                    <Download className="w-5 h-5 animate-bounce" />
                    Download high-res PNG
                  </button>
                </motion.div>
              )}

              {/* TAB 2: BULK INVITATION GENERATOR */}
              {activeTab === "bulk" && (
                <motion.div
                  key="bulk_tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-6"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label htmlFor="bulk_textarea" className="text-sm font-bold text-[#4a2614]">
                        PASTE GUEST NAMES (ONE PER LINE):
                      </label>
                      <button
                        onClick={loadExampleList}
                        className="text-xs font-bold text-[#b58742] hover:text-[#4a2614] underline underline-offset-2 flex items-center gap-1"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Load sample names
                      </button>
                    </div>
                    <textarea
                      id="bulk_textarea"
                      rows={6}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="Kumar Dulal&#10;Ram Bahadur&#10;Sita Sharma&#10;Aashish Adhikari"
                      className="w-full text-base font-medium p-4 bg-[#fdfdfc] border-2 border-[#e6dcce] rounded-xl text-[#3e2723] font-mono placeholder-[#bcaaa4] focus:outline-none focus:border-[#4a2614] transition-all resize-y"
                    />
                  </div>

                  {/* BULK QUEUE ACTIONS HEADER */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      id="btn_bulk_generate"
                      onClick={handleGenerateBulk}
                      disabled={isBulkGenerating}
                      className={`flex-1 py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all ${
                        isBulkGenerating
                          ? "bg-[#e4d6c1] text-[#9c8466] cursor-not-allowed"
                          : "bg-[#274f17] text-white hover:bg-[#1a380e] hover:shadow-lg active:scale-[0.99]"
                      }`}
                    >
                      <RefreshCw className={`w-5 h-5 ${isBulkGenerating ? "animate-spin" : ""}`} />
                      {isBulkGenerating ? "Rendering invitations..." : `Generate ${bulkText.split("\n").filter(n => n.trim().length > 0).length} Invitations`}
                    </button>
                  </div>

                  {/* PROGRESS INDICATOR CONTAINER */}
                  {bulkList.length > 0 && (
                    <div className="border border-[#eaddca] rounded-xl p-4 bg-[#faf7f2] flex flex-col gap-4">
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#4a2614]">RENDER PERFORMANCE:</span>
                        <span className="text-xs font-mono font-bold text-[#274f17] bg-[#274f17]/10 px-2 py-0.5 rounded-full">
                          {bulkProgress}% Ready ({bulkList.filter(x => x.status === 'completed').length}/{bulkList.length})
                        </span>
                      </div>

                      {/* REAL PROGRESS BAR */}
                      <div className="w-full h-3 bg-[#eaddca] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#b58742] to-[#274f17] transition-all duration-300 rounded-full"
                          style={{ width: `${bulkProgress}%` }}
                        />
                      </div>

                      {/* DOWNLOADING ALL ARCHIVES ROW */}
                      {bulkProgress === 100 && (
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <button
                            id="btn_download_zip"
                            onClick={handleDownloadAllZip}
                            className="flex-1 bg-[#4a2614] text-white hover:bg-[#341b0e] py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow-md"
                          >
                            <FileArchive className="w-4 h-4" />
                            Download all as ZIP
                          </button>
                          <button
                            onClick={handleDownloadAllAsPngs}
                            className="flex-1 bg-white text-[#4a2614] border-2 border-[#4a2614] hover:bg-[#faf6ee] py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                          >
                            <Download className="w-4 h-4" />
                            Download images individually
                          </button>
                        </div>
                      )}

                      {/* SCROLLABLE BULK LIST QUEUE */}
                      <div className="max-h-[220px] overflow-y-auto flex flex-col gap-1.5 border border-[#eaddca]/60 rounded-lg p-2 bg-white">
                        {bulkList.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-[#f0e6d6] hover:bg-[#faf9f5] transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 flex items-center justify-center">
                                {item.status === "completed" && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" />
                                )}
                                {item.status === "generating" && (
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
                                )}
                                {item.status === "idle" && (
                                  <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                                )}
                                {item.status === "failed" && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                                )}
                              </span>
                              <span className="font-bold text-[#3e2723] truncate">{item.name}</span>
                              <span className="text-[#a17145] font-mono truncate hidden sm:inline">
                                ({item.fileName})
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {item.status === "generating" && (
                                <span className="text-[#b58742] italic animate-pulse">Rendering...</span>
                              )}
                              {item.status === "completed" && (
                                <>
                                  <span className="text-green-700 font-bold flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded">
                                    <Check className="w-3.5 h-3.5" /> Ready
                                  </span>
                                  <button
                                    onClick={() => downloadIndividualFromList(item)}
                                    className="p-1 px-1.5 rounded bg-[#f3e6d3] text-[#4a2614] hover:bg-[#4a2614] hover:text-white transition-colors"
                                    title="Download customized PNG"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  )}

                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* AI CAPTION GENERATION CARD SECTIONS */}
          <div id="ai_caption_widget" className="bg-[#fbfcfa] border border-[#dceccc] rounded-2xl p-6 shadow-sm flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-2.5 items-center">
                <div className="p-2 bg-[#274f17]/10 text-[#274f17] rounded-lg">
                  <Sparkles className="w-5 h-5 text-[#274f17]" />
                </div>
                <div>
                  <h3 className="font-bold font-serif text-[#16350c] flex items-center gap-2">
                    AI caption builder
                    <span className="text-[10px] bg-[#274f17]/10 px-2 py-0.5 rounded-full text-[#274f17] uppercase tracking-wider font-sans">
                      Gemini model
                    </span>
                  </h3>
                  <p className="text-xs text-[#52634e] mt-0.5">
                    Generate customized, welcoming social share captions or WhatsApp invitation message blocks instantly.
                  </p>
                </div>
              </div>

              <button
                id="btn_ai_generate"
                onClick={fetchAICaptions}
                disabled={isAiLoading}
                className="bg-gradient-to-r from-[#274f17] to-[#4c7e39] text-white hover:brightness-95 p-2.5 px-4 rounded-xl flex items-center gap-2 text-xs font-bold shadow-md transition-all disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? "animate-spin" : ""}`} />
                {isAiLoading ? "Crafting templates..." : "Draft social messages"}
              </button>
            </div>

            {/* ERROR PRESENTATION IF DIRECT GEMINI IS UNAVAILABLE */}
            {aiError && (
              <div className="bg-red-50 border border-red-200/60 rounded-xl p-4 flex gap-3 text-xs text-red-800">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div className="flex flex-col gap-1">
                  <p className="font-bold">AI caption generation is currently unavailable.</p>
                  <p className="text-[#8c2b2b]">The server quota or Gemini connection is unconfigured. Here is a generic invitation caption you can copy directly:</p>
                  <div className="bg-white p-2.5 rounded border border-red-200 mt-1 font-sans italic text-gray-700 flex justify-between items-start gap-4">
                    <span>
                      &ldquo;You are warmly invited to the Grand Opening of C Cube Cottage – “Chatta Chiya Chat” on 2083/03/10 BS (3:00 PM) in Madhutar, Kamalamai-5, Sindhuli. Let&apos;s celebrate memorable moments over delicious food! 🍲❤️&rdquo;
                    </span>
                    <button
                      onClick={() => copyCaptionToClipboard(`You are warmly invited to the Grand Opening of C Cube Cottage – “Chatta Chiya Chat” on 2083/03/10 BS (3:00 PM) in Madhutar, Kamalamai-5, Sindhuli. Let's celebrate memorable moments over delicious food! 🍲❤️`, 99)}
                      className="p-1 px-1.5 rounded bg-gray-100 text-gray-700 hover:bg-[#4a2614] hover:text-white transition-colors self-end flex-shrink-0"
                    >
                      {copiedIndex === 99 ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AI SUGGESTED CAPTIONS RESULTS */}
            {aiCaptions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {aiCaptions.map((cap, i) => (
                  <div
                    key={i}
                    className="bg-white border border-[#eaddca] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-none hover:border-[#bcaaa4] transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-[#b58742] bg-[#fcf5ea] px-2.5 py-1 rounded-full uppercase tracking-wider font-sans">
                        {cap.category}
                      </span>
                      <button
                        onClick={() => copyCaptionToClipboard(cap.text, i)}
                        className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-[#4a2614] hover:text-white transition-all"
                        title="Copy message definition"
                      >
                        {copiedIndex === i ? (
                          <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Copied
                          </span>
                        ) : (
                          <Copy className="w-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-[#3e2723] leading-relaxed italic pr-2 font-serif select-all">
                      &ldquo;{cap.text}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}

            {isAiLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-pulse">
                {[1, 2].map((x) => (
                  <div key={x} className="bg-gray-100/50 h-32 rounded-xl border border-gray-200/40 p-4" />
                ))}
              </div>
            )}

          </div>

        </div>

        {/* RIGHT COLUMN: CARD REAL-TIME LIVE PREVIEW (SPAN 5) */}
        <div id="preview_panel" className={`lg:col-span-5 flex-col items-center gap-4 ${mobileActiveView === "preview" ? "flex animate-fade-in" : "hidden lg:flex"}`}>
          <div className="w-full flex justify-between items-center px-2">
            <h3 className="font-bold text-sm text-[#4a2614] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#b58742]" />
              REAL-TIME OUTPUT CANVAS PREVIEW
            </h3>
            <span className="text-[10px] font-bold text-[#a17145] bg-[#faf3e8] border border-[#eaddca] rounded px-2 py-0.5">
              1200x1680px HD Output
            </span>
          </div>

          {/* DYNAMIC SCALED CANVAS CONTAINER */}
          {/* Framed like a physical print on a museum easel stand */}
          <div className="w-full flex flex-col items-center border-4 border-[#4a2614] rounded-2xl shadow-2xl overflow-hidden p-3 bg-gradient-to-b from-[#dfd0bd] to-[#bcaaa4] relative group">
            {/* Glossy filter reflection cover */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
            
            {/* Absolute Floating Premium Download Button overlay inside preview card */}
            <div className="absolute top-4 right-4 z-20 flex gap-2">
              <button
                type="button"
                onClick={handleDownloadSingle}
                className="bg-[#4a2614] hover:bg-[#274f17] active:scale-90 text-white font-sans p-3 rounded-xl shadow-2xl border border-[#ebdcb9] flex items-center justify-center gap-2 transition-all duration-300 group/down"
                title="Download single high-fidelity card"
              >
                <Download className="w-4.5 h-4.5 shrink-0 text-[#ebdcb9] group-hover/down:text-white group-hover/down:translate-y-0.5 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-wider pr-1">Download PNG</span>
              </button>
            </div>

            {/* The Actual Visible Interactive Canvas */}
            <canvas
              ref={previewCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="w-full h-auto object-contain bg-white rounded-lg shadow-inner select-none transition-transform duration-300 border border-gray-100"
            />
          </div>

          {/* Mobile-friendly gesture companion guidelines */}
          <div className="w-full bg-[#fdfaf5] border border-[#eaddca]/65 rounded-xl p-3 flex items-start gap-2 max-w-sm mt-1">
            <Sparkles className="w-4 h-4 text-[#b58742] shrink-0 mt-0.5 animate-pulse" />
            <p className="text-[11px] text-[#5d4037] leading-normal font-sans">
              <span className="font-bold">Pro Tip:</span> Drag the guest name directly inside the preview above to adjust placement, or press the floating <span className="font-semibold text-[#4a2614]">Download PNG</span> button to download instantly!
            </p>
          </div>

          <p className="text-xs text-[#a17145] text-center max-w-sm leading-relaxed">
            Type guest names in the panel to update instantly. Your downloaded files contain full vector text quality for perfect physical paper output.
          </p>
        </div>

      </main>

      {/* 3. HIDDEN BULK RENDERING DOM CANVAS */}
      <div className="hidden pointer-events-none select-none invisible">
        <canvas ref={hiddenBulkCanvasRef} width={1200} height={1680} />
      </div>

      {/* 4. FOOTER CREDITS */}
      <footer id="workspace_footer" className="bg-[#3e2723] text-[#eaddca] py-8 px-6 mt-12 border-t-2 border-[#bd8a43]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-center md:text-left">
          <div className="flex flex-col gap-1.5">
            <h5 className="font-serif font-bold text-base text-white">C Cube Cottage</h5>
            <p className="text-[#bcaaa4]">
              Madhutar, Kamalamai-5, Sindhuli, Nepal &bull; Chatta Chiya Chat
            </p>
          </div>
          <div className="flex flex-col md:items-end gap-1">
            <p>&copy; 2026 C Cube Cottage Family. All rights reserved.</p>
            <p className="text-[#a17145] font-mono leading-none">
              Crafted in Full-Stack Node Express Workspace
            </p>
          </div>
        </div>
      </footer>

      {/* MOBILE APP-LIKE TAB BAR (Sticky Bottom Panel) */}
      <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 lg:hidden">
        <div className="bg-[#4a2614]/95 backdrop-blur-md shadow-xl border border-[#ebdcb9]/40 rounded-2xl px-2 py-1.5 flex gap-2 max-w-sm w-full mx-auto justify-around">
          <button
            type="button"
            onClick={() => setMobileActiveView("edit")}
            className={`flex-1 flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all ${
              mobileActiveView === "edit"
                ? "bg-[#ebdcb9] text-[#4a2614] shadow-sm font-bold"
                : "text-[#ebdcb9] hover:bg-white/5 font-medium"
            }`}
          >
            <Layers className="w-5 h-5 shrink-0" />
            <span className="text-[10px] uppercase tracking-wider">Designer Inputs</span>
          </button>
          
          <button
            type="button"
            onClick={() => setMobileActiveView("preview")}
            className={`flex-1 flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all ${
              mobileActiveView === "preview"
                ? "bg-[#ebdcb9] text-[#4a2614] shadow-sm font-bold"
                : "text-[#ebdcb9] hover:bg-white/5 font-medium"
            }`}
          >
            <ImageIcon className="w-5 h-5 shrink-0" />
            <span className="text-[10px] uppercase tracking-wider">Live Preview</span>
          </button>
        </div>
      </div>
    </div>
  );
}
