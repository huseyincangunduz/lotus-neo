import type { XDrawData } from "../model/xdraw-data";
import type { ContentBufferViewport } from "./content-buffer-backend";
import type { ContentBufferInfo, ContentBufferRendererOptions } from "./content-buffer-renderer";

export interface ContentBufferWorkerInitializeMessage {
    type: "initialize";
    options: ContentBufferRendererOptions;
}

export interface ContentBufferWorkerSetSnapshotMessage {
    type: "set-snapshot";
    data: XDrawData;
    dataRevision: number;
}

export interface ContentBufferWorkerSetViewportMessage {
    type: "set-viewport";
    viewport: ContentBufferViewport;
    renderRevision: number;
}

export interface ContentBufferWorkerInvalidateMessage {
    type: "invalidate";
}

export interface ContentBufferWorkerRenderMessage {
    type: "render";
    dataRevision: number;
    renderRevision: number;
}

export type ContentBufferWorkerRequest =
    | ContentBufferWorkerInitializeMessage
    | ContentBufferWorkerSetSnapshotMessage
    | ContentBufferWorkerSetViewportMessage
    | ContentBufferWorkerInvalidateMessage
    | ContentBufferWorkerRenderMessage;

export interface ContentBufferWorkerInitializedMessage {
    type: "initialized";
}

export interface ContentBufferWorkerBufferReadyMessage {
    type: "buffer-ready";
    bitmap: ImageBitmap;
    buffer: ContentBufferInfo;
    dataRevision: number;
    renderRevision: number;
}

export interface ContentBufferWorkerErrorMessage {
    type: "error";
    message: string;
    dataRevision?: number;
    renderRevision?: number;
}

export type ContentBufferWorkerResponse =
    | ContentBufferWorkerInitializedMessage
    | ContentBufferWorkerBufferReadyMessage
    | ContentBufferWorkerErrorMessage;
