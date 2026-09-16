import { toastService } from "@libs/ui/alert-toast";
import type { XDrawData, XDrawDrawElement } from "../model/xdraw-data";
import type {
    ContentBufferBackend,
    ContentBufferDelta,
    ContentBufferFrame,
    ContentBufferReadyListener,
    ContentBufferViewport,
} from "./content-buffer-backend";

export class FallbackContentBufferBackend implements ContentBufferBackend {
    private activeBackend: ContentBufferBackend;
    private primaryFailed = false;
    private useLocalRendering = false;
    private activatePrimaryOnNextFrame = false;
    private listeners = new Set<ContentBufferReadyListener>();
    private unsubscribePrimary: () => void;
    private unsubscribeFallback: () => void;


    constructor(
        private readonly primaryBackend: ContentBufferBackend,
        private readonly fallbackBackend: ContentBufferBackend,
    ) {
        this.activeBackend = primaryBackend;
        this.unsubscribePrimary = primaryBackend.onBufferReady((frame) => this.emitFrame(primaryBackend, frame));
        this.unsubscribeFallback = fallbackBackend.onBufferReady((frame) => this.emitFrame(fallbackBackend, frame));
    }

    setSnapshot(data: XDrawData, dataRevision: number): void {
        if (!this.useLocalRendering) {
            this.primaryBackend.setSnapshot(data, dataRevision);
        }
        this.fallbackBackend.setSnapshot(data, dataRevision);
    }

    setUseLocalRendering(enabled: boolean): void {
        this.useLocalRendering = enabled;
        if (enabled) {
            this.activatePrimaryOnNextFrame = false;
            this.activeBackend = this.fallbackBackend;
            return;
        }
        if (!this.primaryFailed && this.activeBackend === this.fallbackBackend) {
            this.activatePrimaryOnNextFrame = true;
        }
    }

    setViewport(viewport: ContentBufferViewport, renderRevision: number): void {
        this.primaryBackend.setViewport(viewport, renderRevision);
        this.fallbackBackend.setViewport(viewport, renderRevision);
    }

    invalidate(): void {
        if (!this.useLocalRendering) {
            this.primaryBackend.invalidate();
        }
        this.fallbackBackend.invalidate();
    }

    async requestBuffer(): Promise<void> {
        const requestedBackend = this.activatePrimaryOnNextFrame
            ? this.primaryBackend
            : this.activeBackend;
        try {
            await requestedBackend.requestBuffer();
        } catch (error) {
            if (requestedBackend !== this.primaryBackend) {
                throw error;
            }
            console.warn("Content buffer worker kullanilamadi, local renderer'a geciliyor.", error);
            toastService.warning("Content buffer: Worker hatasi, local renderer'a gecildi.", 3500);
            this.primaryFailed = true;
            this.activatePrimaryOnNextFrame = false;
            this.activeBackend = this.fallbackBackend;
            this.primaryBackend.dispose();
            await this.fallbackBackend.requestBuffer();
        }
    }

    getCurrentFrame(): ContentBufferFrame | undefined {
        return this.activeBackend.getCurrentFrame();
    }

    onBufferReady(listener: ContentBufferReadyListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    dispose(): void {
        this.unsubscribePrimary();
        this.unsubscribeFallback();
        this.primaryBackend.dispose();
        this.fallbackBackend.dispose();
        this.listeners.clear();
    }

    private emitFrame(backend: ContentBufferBackend, frame: ContentBufferFrame): void {
        if (backend === this.primaryBackend && this.activatePrimaryOnNextFrame) {
            this.activatePrimaryOnNextFrame = false;
            this.activeBackend = this.primaryBackend;
        }
        if (backend !== this.activeBackend) {
            return;
        }
        for (const listener of this.listeners) {
            listener(frame);
        }
    }

    applySnapshotDelta(dataRevision: number, ...deltas: ContentBufferDelta[]): void {
        this.primaryBackend.applySnapshotDelta(dataRevision, ...deltas);

    }
}
