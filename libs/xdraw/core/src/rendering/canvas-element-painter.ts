import { ColorUtils } from "../utils/color-utils";
import type { XDrawDrawElement, XDrawFillElement, XDrawPoint, XDrawTextElement } from "../model/xdraw-data";

export type XDrawRenderingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface DrawPointRange {
    startIndex: number;
    endIndex: number;
}

interface DrawPathSegment {
    path: Path2D;
    lineWidth: number;
    fill: boolean;
}

interface DrawPathCacheEntry {
    segments: DrawPathSegment[];
}

export class CanvasElementPainter {
    private fillPathCache = new WeakMap<XDrawPoint[][], Path2D>();
    private drawPathCache = new WeakMap<XDrawDrawElement["points"], DrawPathCacheEntry>();

    drawDrawElement(
        context: XDrawRenderingContext,
        draw: XDrawDrawElement,
        cameraScale: number,
        colorOverride?: string,
        minLineWidth = 0,
        range?: DrawPointRange,
    ) {
        if (draw.points.length === 0) {
            return;
        }
        const startIndex = range?.startIndex ?? 0;
        const endIndex = range?.endIndex ?? draw.points.length - 1;
        if (startIndex < 0 || endIndex < startIndex || endIndex >= draw.points.length) {
            return;
        }
        const color = colorOverride ?? ColorUtils.regularizeToHexColor(draw.color);
        if (!color) {
            return;
        }

        const segments = this.getDrawPrebuilts(draw, cameraScale, minLineWidth, startIndex, endIndex);
        for (const segment of segments.segments) {
            if (segment.fill) {
                context.fillStyle = color;
                context.fill(segment.path);
                continue;
            }
            context.strokeStyle = color;
            context.lineWidth = segment.lineWidth;
            context.stroke(segment.path);
        }
    }

    drawFillElement(context: XDrawRenderingContext, fill: XDrawFillElement, colorOverride?: string) {
        if (fill.rings.length === 0) {
            return;
        }
        const color = colorOverride ?? ColorUtils.regularizeToHexColor(fill.color);
        if (!color) {
            return;
        }

        let path = this.fillPathCache.get(fill.rings);
        if (!path) {
            path = new Path2D();
            for (const ring of fill.rings) {
                if (ring.length === 0) {
                    continue;
                }
                path.moveTo(ring[0].x, ring[0].y);
                for (let i = 1; i < ring.length; i++) {
                    path.lineTo(ring[i].x, ring[i].y);
                }
                path.closePath();
            }
            this.fillPathCache.set(fill.rings, path);
        }

        context.fillStyle = color;
        context.fill(path, "evenodd");
    }

    drawTextElement(context: XDrawRenderingContext, textElement: XDrawTextElement) {
        const color = ColorUtils.regularizeToHexColor(textElement.color) || textElement.color;
        context.fillStyle = color;
        context.lineWidth = 1;
        context.font = `${textElement.fontWeight || "normal"} ${textElement.fontSize}px ${textElement.fontFamily || "sans-serif"}`;
        context.textBaseline = "top";
        context.fillText(textElement.text, textElement.position.x, textElement.position.y);
    }

    invalidateDrawCache(element: XDrawDrawElement) {
        this.drawPathCache.delete(element.points);
    }

    invalidateAllPathCaches() {
        this.drawPathCache = new WeakMap<XDrawDrawElement["points"], DrawPathCacheEntry>();
        this.fillPathCache = new WeakMap<XDrawPoint[][], Path2D>();
    }

    private getDrawPrebuilts(draw: XDrawDrawElement, cameraScale: number, minLineWidth: number, startIndex: number, endIndex: number): DrawPathCacheEntry {
        const usesFullRange = startIndex === 0 && endIndex === draw.points.length - 1;
        if (minLineWidth > 0 || !usesFullRange) {
            return { segments: this.buildDrawSegments(draw, cameraScale, minLineWidth, startIndex, endIndex).segments };
        }

        const cached = this.drawPathCache.get(draw.points);
        if (cached) {
            return cached;
        }

        const built = this.buildDrawSegments(draw, cameraScale, minLineWidth, startIndex, endIndex);
        if (built.cacheable) {
            const cacheEntry = { segments: built.segments };
            this.drawPathCache.set(draw.points, cacheEntry);
            return cacheEntry;
        }
        return built;
    }

    private buildDrawSegments(
        draw: XDrawDrawElement,
        cameraScale: number,
        minLineWidth: number,
        startIndex: number,
        endIndex: number,
    ): { segments: DrawPathSegment[]; cacheable: boolean } {
        const first = draw.points[startIndex];

        if (startIndex === endIndex) {
            const dot = new Path2D();
            dot.arc(first.x, first.y, Math.max(0.5, minLineWidth / 2, first.size / 2), 0, Math.PI * 2);
            return {
                segments: [{ path: dot, lineWidth: 0, fill: true }],
                cacheable: draw.finalized === true && !draw.partial && startIndex === 0 && endIndex === draw.points.length - 1,
            };
        }

        const segments: DrawPathSegment[] = [];
        let path = new Path2D();
        let lineWidth = Math.max(minLineWidth, first.size);
        path.moveTo(first.x, first.y);

        const minWorldStepSq = minLineWidth > 0 ? 0 : (1 / cameraScale) ** 2;
        let previous = first;
        let skippedPoint = false;
        for (let index = startIndex + 1; index <= endIndex; index++) {
            const point = draw.points[index];
            if (!point.breakBefore && draw.partial && minWorldStepSq > 0 && index !== endIndex) {
                const dx = point.x - previous.x;
                const dy = point.y - previous.y;
                if (dx * dx + dy * dy < minWorldStepSq) {
                    skippedPoint = true;
                    continue;
                }
            }
            if (point.breakBefore) {
                segments.push({ path, lineWidth, fill: false });
                lineWidth = Math.max(minLineWidth, point.size);
                path = new Path2D();
                path.moveTo(point.x, point.y);
                previous = point;
                continue;
            }
            if (point.size !== previous.size) {
                segments.push({ path, lineWidth, fill: false });
                lineWidth = Math.max(minLineWidth, point.size);
                path = new Path2D();
                path.moveTo(previous.x, previous.y);
            }
            path.lineTo(point.x, point.y);
            previous = point;
        }
        segments.push({ path, lineWidth, fill: false });

        const usesFullRange = startIndex === 0 && endIndex === draw.points.length - 1;
        return { segments, cacheable: usesFullRange && draw.finalized === true && !draw.partial && !skippedPoint };
    }
}
