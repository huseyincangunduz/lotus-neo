import type { XDrawCanvasCamera, XDrawData, XDrawElement, XDrawElementPosition, XDrawPoint } from "../model/xdraw-data";
import type { ContentBufferInfo } from "./content-buffer-renderer";

export interface ContentBufferViewport {
    camera: XDrawCanvasCamera;
    width: number;
    height: number;
}

export type ContentBufferSource = HTMLCanvasElement | OffscreenCanvas | ImageBitmap;

export interface ContentBufferFrame {
    source: ContentBufferSource;
    buffer: ContentBufferInfo;
    dataRevision: number;
    renderRevision: number;
}

export interface ContentBufferDelta {
    operation: "upsert-element" | "remove-element" | "insert-points" | "remove-points" | "set-layer-opacity";
    elementId?: string;
    // layerId: string;
    type?: "draw" | "fill" | "text";
    upsertData?: XDrawElement;
    /**
     * Eğer draw elementi ise points, ancak fill ise ringler olacak...
     */
    points?: Array<XDrawElementPosition>;
    rings?: XDrawPoint[][]
    dataRevision?: number;
    layerOpacity?: number;
    layerId?: string;
}

export type ContentBufferReadyListener = (frame: ContentBufferFrame) => void;

export interface ContentBufferBackend {
    setSnapshot(data: XDrawData, dataRevision: number): void;
    applySnapshotDelta( dataRevision: number, ...delta: ContentBufferDelta[]): void;
    setViewport(viewport: ContentBufferViewport, renderRevision: number): void;
    invalidate(): void;
    requestBuffer(): Promise<void>;
    getCurrentFrame(): ContentBufferFrame | undefined;
    onBufferReady(listener: ContentBufferReadyListener): () => void;
    dispose(): void;
}
