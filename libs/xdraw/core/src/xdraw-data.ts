export interface CanvasBackgroundPatternOptions {
    type?: "grid" | "ruler";
    spacing?: number;
    color?: string;
    opacity?: number;
}

export interface XDrawCanvasCamera {
    // x, y: canvasin sol-ust kosesinde (piksel 0,0) gorunen dunya koordinati.
    // scale: dunya birimi basina ekran pikseli (scale artarsa yakinlasir).
    x: number;
    y: number;
    scale: number;
}

export type InteractionMode = "idle" | "draw" | "erase" | "fill" | "pan";

// Flood fill icin uretilen, sadece aktif katmanin cizgilerini iceren offscreen raster.
// Maske piksel -> dunya donusumu: world = origin + pixel / scale
export interface XDrawFillMask {
    imageData: ImageData;
    width: number;
    height: number;
    originX: number;
    originY: number;
    scale: number;
}

export interface RenderStats {
    fps: number;
    renderMs: number;
    bitmapFallbackCount: number;
}

// Konum ve büyüklük bilgilerini temsil eden arayüz
export interface XDrawElementPosition {
    x: number;
    y: number;
    size: number;
    breakBefore?: boolean;
}

export const XDRAW_MAX_POINTS_PER_ELEMENT = 256;

export interface XDrawSize {
    width: number;
    height: number;
}

// Elementler

export interface XDrawElement {
    id: string;
    type: string;

    // Crop edildiği zaman tam element görünmez, sadece crop alanı görünür. Crop alanı dışında kalan kısımlar çizilmez. Bu özellik yanlış önbelleklemeyi önlemek için kullanılır. 
    partial?: boolean;
}

export interface XDrawDrawElement extends XDrawElement {
    type: "draw";
    color: string;
    points: Array<XDrawElementPosition>;
    finalized?: boolean;
}

export interface XDrawTextElement extends XDrawElement {
    type: "text";
    text: string;
    position: XDrawElementPosition;
    fontSize: number;
    fontFamily: string;
    color: string;
    finalized?: boolean;
}

export interface XDrawPoint {
    x: number;
    y: number;
}

// Ilk ring dis sinir, sonraki ring'ler delik (evenodd kurali ile doldurulur).
export interface XDrawFillElement extends XDrawElement {
    type: "fill";
    color: string;
    rings: XDrawPoint[][];
    seed?: XDrawPoint;
}


// Katmanlar

export interface XDrawLayer {
    id: string;
    type: "layer";
    elements: XDrawElement[];
    opacity?: number;
    visible?: boolean;
    // currentSessionActive?: boolean;
}

// Kök veri yapısı

export interface XDrawData {
    layers: XDrawLayer[];
}

