import type { XDrawCanvasCamera, XDrawData, XDrawDrawElement, XDrawFillElement, XDrawTextElement } from "../model/xdraw-data";
import { XdrawDataUtils } from "../utils/xdraw-data-utils";
import { CanvasElementPainter, type XDrawRenderingContext } from "./canvas-element-painter";

export type ContentBufferCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface ContentBufferInfo {
    originX: number;
    originY: number;
    scale: number;
    width: number;
    height: number;
}

export interface ContentBufferRendererOptions {
    marginRatio: number;
    maxPixels: number;
    scaleMinRatio: number;
    scaleMaxRatio: number;
}

export class ContentBufferRenderer {
    private canvas?: ContentBufferCanvas;
    private buffer?: ContentBufferInfo;
    private valid = false;

    constructor(
        private readonly elementPainter: CanvasElementPainter,
        private readonly createCanvas: (width: number, height: number) => ContentBufferCanvas,
        private readonly options: ContentBufferRendererOptions,
    ) { }

    getCanvas(): ContentBufferCanvas | undefined {
        return this.canvas;
    }

    getBufferInfo(): ContentBufferInfo | undefined {
        return this.buffer;
    }

    invalidate() {
        this.valid = false;
    }

    isCurrent(camera: XDrawCanvasCamera, viewportWidth: number, viewportHeight: number): boolean {
        if (!this.valid || !this.buffer) {
            return false;
        }

        const scaleRatio = camera.scale / this.buffer.scale;
        if (scaleRatio < this.options.scaleMinRatio || scaleRatio > this.options.scaleMaxRatio) {
            return false;
        }

        const viewRight = camera.x + viewportWidth / camera.scale;
        const viewBottom = camera.y + viewportHeight / camera.scale;
        const bufferRight = this.buffer.originX + this.buffer.width / this.buffer.scale;
        const bufferBottom = this.buffer.originY + this.buffer.height / this.buffer.scale;
        const safetyPadX = (bufferRight - this.buffer.originX) * 0.05;
        const safetyPadY = (bufferBottom - this.buffer.originY) * 0.05;

        return (
            camera.x >= this.buffer.originX + safetyPadX &&
            camera.y >= this.buffer.originY + safetyPadY &&
            viewRight <= bufferRight - safetyPadX &&
            viewBottom <= bufferBottom - safetyPadY
        );
    }

    rebuild(data: XDrawData, camera: XDrawCanvasCamera, viewportWidth: number, viewportHeight: number) {
        const rebuildStart = performance.now();
        const cameraScale = camera.scale;
        const marginX = Math.round(viewportWidth * this.options.marginRatio);
        const marginY = Math.round(viewportHeight * this.options.marginRatio);
        let width = Math.max(1, viewportWidth + marginX * 2);
        let height = Math.max(1, viewportHeight + marginY * 2);
        let bufferScale = cameraScale;

        const pixelCount = width * height;
        if (pixelCount > this.options.maxPixels) {
            const ratio = Math.sqrt(this.options.maxPixels / pixelCount);
            width = Math.max(1, Math.floor(width * ratio));
            height = Math.max(1, Math.floor(height * ratio));
            bufferScale = cameraScale * ratio;
        }

        const originX = camera.x - marginX / cameraScale;
        const originY = camera.y - marginY / cameraScale;
        const canvas = this.getOrCreateCanvas(width, height);
        const context = canvas.getContext("2d") as XDrawRenderingContext | null;
        if (!context) {
            return;
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, width, height);
        context.setTransform(bufferScale, 0, 0, bufferScale, -originX * bufferScale, -originY * bufferScale);
        context.lineCap = "round";
        context.lineJoin = "round";

        XdrawDataUtils.cropXDrawData(
            data,
            { x: originX, y: originY, scale: bufferScale },
            width,
            height,
            (found) => {
                const element = found.element;
                if (!element || (element.type === "draw" && (element as XDrawDrawElement).finalized === false)) {
                    return;
                }

                const layerOpacity = found.layerOpacity ?? 1;
                if (context.globalAlpha !== layerOpacity) {
                    context.globalAlpha = layerOpacity;
                }
                if (element.type === "draw") {
                    this.elementPainter.drawDrawElement(
                        context,
                        element as XDrawDrawElement,
                        cameraScale,
                        undefined,
                        0,
                        {
                            startIndex: found.pointStartIndex ?? 0,
                            endIndex: found.pointEndIndex ?? Math.max(0, (found.points?.length ?? 1) - 1),
                        },
                    );
                } else if (element.type === "fill") {
                    this.elementPainter.drawFillElement(context, element as XDrawFillElement);
                } else if (element.type === "text") {
                    this.elementPainter.drawTextElement(context, element as XDrawTextElement);
                }
            },
        );

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
        this.buffer = { originX, originY, scale: bufferScale, width, height };
        this.valid = true;

        const rebuildMs = performance.now() - rebuildStart;
        if (rebuildMs > 16) {
            console.debug(`[xdraw-perf] rebuildContentBuffer ${rebuildMs.toFixed(1)}ms (width=${width} height=${height})`);
        }
    }

    private getOrCreateCanvas(width: number, height: number): ContentBufferCanvas {
        if (!this.canvas) {
            this.canvas = this.createCanvas(width, height);
        }
        if (this.canvas.width !== width) {
            this.canvas.width = width;
        }
        if (this.canvas.height !== height) {
            this.canvas.height = height;
        }
        return this.canvas;
    }
}
