/**
 * Robust, high-fidelity Canvas Renderer for C Cube Grand Opening Invitation
 * Draws layouts at 1200 x 1680 px base resolution
 */

export function drawInvitation(
  canvas: HTMLCanvasElement,
  guestName: string,
  config?: {
    fontFamily?: string;
    fontSize?: number;
    yOffset?: number;
    xOffset?: number;
    customBackground?: string | null;
  },
  onComplete?: () => void
): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(canvas);
      return;
    }

    const fontFamily = config?.fontFamily || "Great Vibes";
    const customFontSize = config?.fontSize || 64;
    const yOffset = config?.yOffset !== undefined ? config.yOffset : 0;
    const xOffset = config?.xOffset !== undefined ? config.xOffset : 0;
    
    // Choose custom background uploaded, or default to the original attached image card
    const bgImageSource = config?.customBackground || "/assets/width_1054.svg";

    const width = 1200;
    const height = 1680;
    canvas.width = width;
    canvas.height = height;

    // Set default anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const img = new Image();
    if (bgImageSource && !bgImageSource.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.src = bgImageSource;
    
    img.onload = () => {
      // 1. Draw template image across the exact template resolution
      ctx.drawImage(img, 0, 0, width, height);

      // 2. Draw all static template text content programmatically if USING DEFAULT TEMPLATE
      // This resolves the web sandboxing block where SVG text font-family fallbacks to cursive/Arial
      if (!config?.customBackground) {
        drawTemplateTextOverlays(ctx);
      }

      // 3. Draw dynamic Guest Name overlay
      let fontSuffix = "cursive";
      if (fontFamily === "Playfair Display") fontSuffix = "serif";
      else if (fontFamily === "Montserrat") fontSuffix = "sans-serif";
      else if (fontFamily === "JetBrains Mono") fontSuffix = "monospace";

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      
      // Default center placement aligned over the original guest line slot
      const gY = 770;
      const defaultCenterX = 695;

      ctx.font = `500 ${customFontSize}px '${fontFamily}', ${fontSuffix}`;
      ctx.fillStyle = "#1e1008"; // Premium deep espresso brown matching the original ink
      
      ctx.fillText(guestName || "", defaultCenterX + xOffset, gY - 4 + yOffset);
      ctx.restore();

      if (onComplete) {
        onComplete();
      }
      resolve(canvas);
    };

    img.onerror = (e) => {
      console.error("Failed to load background template image inside Renderer:", e);
      // Draw plain elegant fallback color if loading fails for any reason
      ctx.fillStyle = "#faf5e7";
      ctx.fillRect(0, 0, width, height);
      
      ctx.fillStyle = "#4a2614";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Failed to load template image", width / 2, height / 2 - 40);
      ctx.fillText("Please upload an invitation image or check network connection.", width / 2, height / 2 + 10);
      
      ctx.font = `400 ${customFontSize}px '${fontFamily}'`;
      ctx.fillText(guestName || "", width / 2 + xOffset, height / 2 + 140 + yOffset);
      
      if (onComplete) {
        onComplete();
      }
      resolve(canvas);
    };
  });
}

/**
 * Draws all the high-contrast beautifully styled template typography layout
 * directly on Canvas to guarantee 100% vector accuracy with high anti-aliasing
 * and official Google Web Fonts loaded by the browser.
 */
function drawTemplateTextOverlays(ctx: CanvasRenderingContext2D) {
  ctx.save();

  // Helper function to set custom letter spacing
  const setSpacing = (spacing: string) => {
    try {
      (ctx as any).letterSpacing = spacing;
    } catch (e) {
      // Fallback for older browsers
    }
  };

  // Reset spacing default
  setSpacing("normal");

  // A. Logo Emblem Text: "C CUBE COTTAGE"
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#3e2723";
  ctx.font = "900 25px 'Montserrat', sans-serif";
  setSpacing("2px");
  ctx.fillText("C CUBE COTTAGE", 600, 360);
  ctx.restore();

  // B. Logo Emblem Tagline: "— CHATTA CHIYA CHAT —"
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#a17145";
  ctx.font = "700 12px 'Montserrat', sans-serif";
  setSpacing("4px");
  ctx.fillText("— CHATTA CHIYA CHAT —", 600, 386);
  ctx.restore();

  // C. "YOU ARE INVITED TO OUR"
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#8a623a";
  ctx.font = "750 19px 'Montserrat', sans-serif";
  setSpacing("3.5px");
  ctx.fillText("YOU ARE INVITED TO OUR", 600, 440);
  ctx.restore();

  // D. "GRAND"
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#1e1008";
  ctx.font = "900 138px 'Playfair Display', Georgia, serif";
  setSpacing("4px");
  ctx.fillText("GRAND", 600, 582);
  ctx.restore();

  // E. "Opening"
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#9e6d34";
  ctx.font = "400 118px 'Great Vibes', 'Brush Script MT', cursive";
  ctx.fillText("Opening", 625, 618);
  ctx.restore();

  // F. Ribbon text: "I N V I T A T I O N"
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 25px 'Montserrat', sans-serif";
  setSpacing("8px");
  ctx.fillText("I N V I T A T I O N", 600, 697);
  ctx.restore();

  // G. Salutation: "Dear Mr./Mrs."
  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#1e1008";
  ctx.font = "52px 'Great Vibes', 'Brush Script MT', cursive";
  ctx.fillText("Dear Mr./Mrs.", 140, 776);
  ctx.restore();

  // H. Salutation ending comma: ","
  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#1e1008";
  ctx.font = "900 34px 'Playfair Display', Georgia, serif";
  ctx.fillText(",", 1018, 786);
  ctx.restore();

  // I. Invitation Warm Body Texts (aligned beautifully starting from x=80)
  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#321a0c";
  ctx.font = "600 25px 'Montserrat', sans-serif";
  ctx.fillText("We warmly invite you to the Grand Opening of ", 80, 845);
  ctx.restore();

  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#1c0a02";
  ctx.font = "800 26px 'Montserrat', sans-serif";
  ctx.fillText("C Cube Cottage – “Chatta Chiya Chat”.", 80, 883);
  ctx.restore();

  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#442c1d";
  ctx.font = "500 21.5px 'Montserrat', sans-serif";
  ctx.fillText("Join us as we celebrate the beginning of a place built for", 80, 930);
  ctx.restore();

  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#442c1d";
  ctx.font = "500 21.5px 'Montserrat', sans-serif";
  ctx.fillText("connection, conversation, and memorable moments over food.", 80, 962);
  ctx.restore();

  // J. Bento Info Grid Box details (Location, Date, Time) - Enlarged and beautifully spaced
  // 1. Location details
  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#1a0a03";
  ctx.font = "900 28px 'Montserrat', sans-serif";
  setSpacing("1.2px");
  ctx.fillText("LOCATION:", 177, 1052);
  ctx.restore();

  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#583c26";
  ctx.font = "600 22px 'Montserrat', sans-serif";
  ctx.fillText("Madhutar, Kamalamai-5, Sindhuli", 177, 1084);
  ctx.restore();

  // 2. Date details
  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#1a0a03";
  ctx.font = "950 28px 'Montserrat', sans-serif";
  setSpacing("1.2px");
  ctx.fillText("DATE:", 177, 1172);
  ctx.restore();

  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#1a0a03";
  ctx.font = "800 26px 'Montserrat', sans-serif";
  setSpacing("0.5px");
  ctx.fillText("2083/03/10", 177, 1204);
  ctx.restore();

  // 3. Time details
  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#1a0a03";
  ctx.font = "950 28px 'Montserrat', sans-serif";
  setSpacing("1.2px");
  ctx.fillText("TIME:", 177, 1292);
  ctx.restore();

  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#1a0a03";
  ctx.font = "800 26px 'Montserrat', sans-serif";
  setSpacing("0.5px");
  ctx.fillText("3:00 PM", 177, 1324);
  ctx.restore();

  // K. Small Ceramic Cup Emblem branding at bottom-right center
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#3e2723";
  ctx.font = "900 8px 'Montserrat', sans-serif";
  setSpacing("0.2px");
  ctx.fillText("C CUBE COTTAGE", 874, 1222);
  ctx.restore();

  // L. Warm Regards Section (Bottom-Left)
  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#fff4e0";
  ctx.font = "48px 'Great Vibes', 'Brush Script MT', cursive";
  ctx.fillText("Warm Regards,", 84, 1526);
  ctx.restore();

  ctx.save();
  ctx.textAlign = "start";
  ctx.fillStyle = "#fff4e0";
  ctx.font = "900 29px 'Montserrat', sans-serif";
  ctx.fillText("C Cube Cottage Family", 84, 1576);
  ctx.restore();

  // M. Elegant Golden-Brown Calligraphic Quote on Torn-Paper Background (Bottom-Right)
  // Good Food,
  ctx.save();
  ctx.translate(580 + 265, 1220 + 215);
  ctx.rotate(-7 * Math.PI / 180);
  ctx.textAlign = "start";
  ctx.fillStyle = "#fff4e0"; // Rich radiant cream gold for gorgeous readability and contrast
  ctx.font = "400 46px 'Great Vibes', 'Brush Script MT', cursive";
  ctx.fillText("Good Food, ", 0, 0);
  ctx.restore();

  // Great Company,
  ctx.save();
  ctx.translate(580 + 230, 1220 + 285);
  ctx.rotate(-6 * Math.PI / 180);
  ctx.textAlign = "start";
  ctx.fillStyle = "#fff4e0";
  ctx.font = "400 46px 'Great Vibes', 'Brush Script MT', cursive";
  ctx.fillText("Great Company,", 0, 0);
  ctx.restore();

  // Beautiful Memories.
  ctx.save();
  ctx.translate(580 + 180, 1220 + 355);
  ctx.rotate(-5 * Math.PI / 180);
  ctx.textAlign = "start";
  ctx.fillStyle = "#fff4e0";
  ctx.font = "400 46px 'Great Vibes', 'Brush Script MT', cursive";
  ctx.fillText("Beautiful Memories.", 0, 0);
  ctx.restore();

  ctx.restore();
}
