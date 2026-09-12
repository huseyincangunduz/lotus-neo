import { toastService } from "@libs/ui/alert-toast";
import type { XDrawData } from "../model/xdraw-data";
import type {
    ContentBufferBackend,
    ContentBufferFrame,
    ContentBufferReadyListener,
    ContentBufferViewport,
} from "./content-buffer-backend";

export class FallbackContentBufferBackend implements ContentBufferBackend {
    private activeBackend: ContentBufferBackend;
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
        this.primaryBackend.setSnapshot(data, dataRevision);
        this.fallbackBackend.setSnapshot(data, dataRevision);
    }

    setViewport(viewport: ContentBufferViewport, renderRevision: number): void {
        this.primaryBackend.setViewport(viewport, renderRevision);
        this.fallbackBackend.setViewport(viewport, renderRevision);
    }

    invalidate(): void {
        this.primaryBackend.invalidate();
        this.fallbackBackend.invalidate();
    }

    async requestBuffer(): Promise<void> {
        try {
            await this.activeBackend.requestBuffer();
        } catch (error) {
            if (this.activeBackend !== this.primaryBackend) {
                throw error;
            }
            console.warn("Content buffer worker kullanilamadi, local renderer'a geciliyor.", error);
            toastService.warning("Content buffer: Worker hatasi, local renderer'a gecildi.", 3500);
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
        if (backend !== this.activeBackend) {
            return;
        }
        for (const listener of this.listeners) {
            listener(frame);
        }
    }
}
