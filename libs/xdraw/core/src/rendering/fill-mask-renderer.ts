import type { XDrawCanvasCamera, XDrawDrawElement, XDrawElement, XDrawFillElement, XDrawFillMask, XDrawLayer, XDrawTextElement } from "../model/xdraw-data";
import { CanvasElementPainter, type XDrawRenderingContext } from "./canvas-element-painter";

type RasterCanvas = HTMLCanvasElement | OffscreenCanvas;

export class FillMaskRenderer {
    private static readonly MARGIN_RATIO = 0.25;
    private static readonly MAX_PIXELS = 4_000_000;

    private canvas?: RasterCanvas;

    constructor(
        private readonly elementPainter: CanvasElementPainter,
        private readonly createCanvas: (width: number, height: number) => RasterCanvas,
    ) { }

    create(layer: XDrawLayer, camera: XDrawCanvasCamera, viewportWidth: number, viewportHeight: number): XDrawFillMask | null {
        const cameraScale = camera.scale;
        const marginX = Math.round(viewportWidth * FillMaskRenderer.MARGIN_RATIO);
        const marginY = Math.round(viewportHeight * FillMaskRenderer.MARGIN_RATIO);
        let width = Math.max(1, viewportWidth + marginX * 2);
        let height = Math.max(1, viewportHeight + marginY * 2);
        let maskScale = cameraScale;

        const pixelCount = width * height;
        if (pixelCount > FillMaskRenderer.MAX_PIXELS) {
            const ratio = Math.sqrt(FillMaskRenderer.MAX_PIXELS / pixelCount);
            width = Math.max(1, Math.floor(width * ratio));
            height = Math.max(1, Math.floor(height * ratio));
            maskScale = cameraScale * ratio;
        }

        const originX = camera.x - marginX / cameraScale;
        const originY = camera.y - marginY / cameraScale;
        const canvas = this.getCanvas(width, height);
        const context = canvas.getContext("2d") as XDrawRenderingContext | null;
        if (!context) {
            return null;
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
        context.clearRect(0, 0, width, height);
        context.setTransform(maskScale, 0, 0, maskScale, -originX * maskScale, -originY * maskScale);

        this.drawLayer(context, layer, maskScale, originX, originY, width / maskScale, height / maskScale);

        const imageData = context.getImageData(0, 0, width, height);
        context.setTransform(1, 0, 0, 1, 0, 0);
        return { imageData, width, height, originX, originY, scale: maskScale };
    }

    private getCanvas(width: number, height: number): RasterCanvas {
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

    private drawLayer(
        context: XDrawRenderingContext,
        layer: XDrawLayer,
        maskScale: number,
        worldLeft: number,
        worldTop: number,
        worldWidth: number,
        worldHeight: number,
    ) {
        const worldRight = worldLeft + worldWidth;
        const worldBottom = worldTop + worldHeight;
        context.lineCap = "round";
        context.lineJoin = "round";
        const minWorldLineWidth = 1 / maskScale;

        for (const element of layer.elements) {
            if (!this.elementIntersectsRect(element, worldLeft, worldTop, worldRight, worldBottom)) {
                continue;
            }
            if (element.type === "fill") {
                this.elementPainter.drawFillElement(context, element as XDrawFillElement, "#000000");
            } else if (element.type === "draw") {
                this.elementPainter.drawDrawElement(context, element as XDrawDrawElement, maskScale, "#000000", minWorldLineWidth);
            }
        }
    }

    private elementIntersectsRect(element: XDrawElement, left: number, top: number, right: number, bottom: number): boolean {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        if (element.type === "draw") {
            for (const point of (element as XDrawDrawElement).points) {
                if (point.x < minX) minX = point.x;
                if (point.y < minY) minY = point.y;
                if (point.x > maxX) maxX = point.x;
                if (point.y > maxY) maxY = point.y;
            }
        } else if (element.type === "fill") {
            for (const ring of (element as XDrawFillElement).rings) {
                for (const point of ring) {
                    if (point.x < minX) minX = point.x;
                    if (point.y < minY) minY = point.y;
                    if (point.x > maxX) maxX = point.x;
                    if (point.y > maxY) maxY = point.y;
                }
            }
        } else if (element.type === "text") {
            const textElement = element as XDrawTextElement;
            minX = textElement.position.x;
            minY = textElement.position.y;
            maxX = minX + textElement.fontSize * textElement.text.length;
            maxY = minY + textElement.fontSize;
        } else {
            return false;
        }

        return Number.isFinite(minX) && minX <= right && maxX >= left && minY <= bottom && maxY >= top;
    }
}
