import type { XDrawData } from "../model/xdraw-data";
import type {
    ContentBufferBackend,
    ContentBufferFrame,
    ContentBufferReadyListener,
    ContentBufferViewport,
} from "./content-buffer-backend";
import type { ContentBufferRendererOptions } from "./content-buffer-renderer";
import { isContentBufferCurrent } from "./content-buffer-utils";
import type { ContentBufferWorkerRequest, ContentBufferWorkerResponse } from "./content-buffer-worker-messages";

interface PendingRequest {
    promise: Promise<void>;
    resolve: () => void;
    reject: (reason?: unknown) => void;
}

export class WorkerContentBufferBackend implements ContentBufferBackend {
    private dataRevision = 0;
    private renderRevision = 0;
    private viewport?: ContentBufferViewport;
    private currentFrame?: ContentBufferFrame;
    private invalidated = true;
    private disposed = false;
    private failure?: Error;
    private listeners = new Set<ContentBufferReadyListener>();
    private pendingRequests = new Map<string, PendingRequest>();

    constructor(
        private readonly worker: Worker,
        private readonly options: ContentBufferRendererOptions,
    ) {
        worker.onmessage = (event: MessageEvent<ContentBufferWorkerResponse>) => this.handleMessage(event.data);
        worker.onerror = (event) => {
            this.failure = new Error(event.message || "Content buffer worker failed.");
            this.rejectAll(this.failure);
        };
        this.postMessage({ type: "initialize", options });
    }

    setSnapshot(data: XDrawData, dataRevision: number): void {
        this.dataRevision = dataRevision;
        this.postMessage({ type: "set-snapshot", data, dataRevision });
    }

    setViewport(viewport: ContentBufferViewport, renderRevision: number): void {
        this.viewport = viewport;
        this.renderRevision = renderRevision;
        this.postMessage({ type: "set-viewport", viewport, renderRevision });
    }

    invalidate(): void {
        this.invalidated = true;
        this.postMessage({ type: "invalidate" });
    }

    requestBuffer(): Promise<void> {
        if (this.failure) {
            return Promise.reject(this.failure);
        }
        if (this.disposed || !this.viewport) {
            return Promise.resolve();
        }
        if (!this.invalidated && isContentBufferCurrent(this.currentFrame?.buffer, this.viewport, this.options)) {
            return Promise.resolve();
        }

        const dataRevision = this.dataRevision;
        const renderRevision = this.renderRevision;
        const requestKey = this.getRequestKey(dataRevision, renderRevision);
        const pending = this.pendingRequests.get(requestKey);
        if (pending) {
            return pending.promise;
        }

        let resolveRequest!: () => void;
        let rejectRequest!: (reason?: unknown) => void;
        const promise = new Promise<void>((resolve, reject) => {
            resolveRequest = resolve;
            rejectRequest = reject;
        });
        this.pendingRequests.set(requestKey, {
            promise,
            resolve: resolveRequest,
            reject: rejectRequest,
        });
        this.postMessage({ type: "render", dataRevision, renderRevision });
        return promise;
    }

    getCurrentFrame(): ContentBufferFrame | undefined {
        return this.currentFrame;
    }

    onBufferReady(listener: ContentBufferReadyListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.worker.terminate();
        this.closeCurrentBitmap();
        this.rejectAll(new Error("Content buffer worker was disposed."));
        this.listeners.clear();
        this.viewport = undefined;
    }

    private handleMessage(message: ContentBufferWorkerResponse): void {
        if (message.type === "initialized") {
            return;
        }
        if (message.type === "error") {
            const error = new Error(message.message);
            if (message.dataRevision !== undefined && message.renderRevision !== undefined) {
                this.rejectRequest(message.dataRevision, message.renderRevision, error);
            } else {
                this.failure = error;
                this.rejectAll(error);
            }
            return;
        }

        this.resolveRequest(message.dataRevision, message.renderRevision);
        if (
            this.disposed ||
            message.dataRevision !== this.dataRevision ||
            message.renderRevision !== this.renderRevision
        ) {
            message.bitmap.close();
            return;
        }

        this.closeCurrentBitmap();
        const frame: ContentBufferFrame = {
            source: message.bitmap,
            buffer: message.buffer,
            dataRevision: message.dataRevision,
            renderRevision: message.renderRevision,
        };
        this.currentFrame = frame;
        this.invalidated = false;
        for (const listener of this.listeners) {
            listener(frame);
        }
    }

    private postMessage(message: ContentBufferWorkerRequest): void {
        if (!this.disposed) {
            this.worker.postMessage(message);
        }
    }

    private getRequestKey(dataRevision: number, renderRevision: number): string {
        return `${dataRevision}:${renderRevision}`;
    }

    private resolveRequest(dataRevision: number, renderRevision: number): void {
        const requestKey = this.getRequestKey(dataRevision, renderRevision);
        const pending = this.pendingRequests.get(requestKey);
        if (pending) {
            this.pendingRequests.delete(requestKey);
            pending.resolve();
        }
    }

    private rejectRequest(dataRevision: number, renderRevision: number, error: Error): void {
        const requestKey = this.getRequestKey(dataRevision, renderRevision);
        const pending = this.pendingRequests.get(requestKey);
        if (pending) {
            this.pendingRequests.delete(requestKey);
            pending.reject(error);
        }
    }

    private rejectAll(error: Error): void {
        for (const pending of this.pendingRequests.values()) {
            pending.reject(error);
        }
        this.pendingRequests.clear();
    }

    private closeCurrentBitmap(): void {
        if (this.currentFrame?.source instanceof ImageBitmap) {
            this.currentFrame.source.close();
        }
        this.currentFrame = undefined;
    }
}
