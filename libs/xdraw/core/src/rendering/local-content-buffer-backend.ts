import type { XDrawData, XDrawDrawElement } from "../model/xdraw-data";
import type {
    ContentBufferBackend,
    ContentBufferDelta,
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
        this.currentFrame = undefined;
        this.renderer.invalidate();
    }

    setUseLocalRendering(_enabled: boolean): void { }

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

    applySnapshotDelta(dataRevision: number, ...deltas: ContentBufferDelta[]): void {
        if (!this.data) {
            return;
        }

        for (const activeLayer of this.data.layers) {
            for (const delta of deltas) {
                if (activeLayer.elements.length === 0 || !activeLayer.visible) {
                    continue;
                }
                if (delta.operation === "upsert-element" && delta.upsertData) {
                    const index = activeLayer.elements.findIndex(e => e.id === delta.elementId);
                    if (index !== -1) {
                        activeLayer.elements[index] = delta.upsertData;
                    } else {
                        activeLayer.elements.push(delta.upsertData);
                    }

                }
                const alreadyExistElement = activeLayer.elements.find(e => e.id === delta.elementId);

                if (delta.operation === "remove-element") {
                    activeLayer.elements = activeLayer.elements.filter(e => e.id !== delta.elementId);
                } else if (delta.operation === "insert-points" && delta.points) {
                    if (alreadyExistElement && alreadyExistElement.type === "draw") {
                        let alreadyExistDrawELement = alreadyExistElement as XDrawDrawElement
                        alreadyExistDrawELement.points.push(...delta.points);
                    }
                } else if (delta.operation === "remove-points" && delta.points) {
                    let alreadyExistDrawELement = alreadyExistElement as XDrawDrawElement

                    if (alreadyExistElement && alreadyExistElement.type === "draw" && alreadyExistDrawELement.points) {
                        alreadyExistDrawELement.points = alreadyExistDrawELement.points.filter(p => !delta.points!.some(dp => dp.x === p.x && dp.y === p.y));
                    }
                }
            }
        }
        this.dataRevision = dataRevision;
        this.currentFrame = undefined;
        this.renderer.invalidate();
    }
}
