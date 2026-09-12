import type { XDrawData } from "../model/xdraw-data";
import type {
    ContentBufferBackend,
    ContentBufferFrame,
    ContentBufferReadyListener,
    ContentBufferViewport,
} from "./content-buffer-backend";
import { ContentBufferRenderer } from "./content-buffer-renderer";

export class LocalContentBufferBackend implements ContentBufferBackend {
    private data?: XDrawData;
    private dataRevision = 0;
    private viewport?: ContentBufferViewport;
    private renderRevision = 0;
    private currentFrame?: ContentBufferFrame;
    private listeners = new Set<ContentBufferReadyListener>();

    constructor(private readonly renderer: ContentBufferRenderer) { }

    setSnapshot(data: XDrawData, dataRevision: number): void {
        this.data = data;
        this.dataRevision = dataRevision;
    }

    setViewport(viewport: ContentBufferViewport, renderRevision: number): void {
        this.viewport = viewport;
        this.renderRevision = renderRevision;
    }

    invalidate(): void {
        this.renderer.invalidate();
    }

    async requestBuffer(): Promise<void> {
        if (!this.data || !this.viewport) {
            return;
        }

        const { camera, width, height } = this.viewport;
        const needsRebuild = !this.renderer.isCurrent(camera, width, height);
        if (needsRebuild) {
            this.renderer.rebuild(this.data, camera, width, height);
        }

        const source = this.renderer.getCanvas();
        const buffer = this.renderer.getBufferInfo();
        if (!source || !buffer) {
            return;
        }

        const frame: ContentBufferFrame = {
            source,
            buffer,
            dataRevision: this.dataRevision,
            renderRevision: this.renderRevision,
        };
        this.currentFrame = frame;
        if (needsRebuild) {
            for (const listener of this.listeners) {
                listener(frame);
            }
        }
    }

    getCurrentFrame(): ContentBufferFrame | undefined {
        return this.currentFrame;
    }

    onBufferReady(listener: ContentBufferReadyListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    dispose(): void {
        this.listeners.clear();
        this.currentFrame = undefined;
        this.data = undefined;
        this.viewport = undefined;
    }
}
