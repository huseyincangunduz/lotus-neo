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
}

export interface XDrawSize {
    width: number;
    height: number;
}

// Elementler

export interface XDrawElement {
    id: string;
    type: string;
}


export interface XDrawDrawElement extends XDrawElement {
    type: "draw";
    color: string;
    points: Array<XDrawElementPosition>;
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
    currentSessionActive?: boolean;
}

// Kök veri yapısı

export interface XDrawData {
    layers: XDrawLayer[];
}

