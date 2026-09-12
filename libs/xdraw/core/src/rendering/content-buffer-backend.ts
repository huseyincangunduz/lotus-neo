import type { XDrawCanvasCamera, XDrawData } from "../model/xdraw-data";
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

export type ContentBufferReadyListener = (frame: ContentBufferFrame) => void;

export interface ContentBufferBackend {
    setSnapshot(data: XDrawData, dataRevision: number): void;
    setViewport(viewport: ContentBufferViewport, renderRevision: number): void;
    invalidate(): void;
    requestBuffer(): void;
    getCurrentFrame(): ContentBufferFrame | undefined;
    onBufferReady(listener: ContentBufferReadyListener): () => void;
    dispose(): void;
}
