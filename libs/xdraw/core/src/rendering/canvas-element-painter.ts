import { ColorUtils } from "../utils/color-utils";
import type { XDrawDrawElement, XDrawFillElement, XDrawPoint, XDrawTextElement, XDrawShapeElement } from "../model/xdraw-data";

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

export interface PathBuildStats {
    buildMs: number;
    buildCount: number;
    cacheHits: number;
    maxBuildMs: number;
}

export class CanvasElementPainter {
    private fillPathCache = new WeakMap<XDrawPoint[][], Path2D>();
    private drawPathCache = new WeakMap<XDrawDrawElement["points"], DrawPathCacheEntry>();
    private pathBuildStats: PathBuildStats = { buildMs: 0, buildCount: 0, cacheHits: 0, maxBuildMs: 0 };

    resetPathBuildStats() {
        this.pathBuildStats = { buildMs: 0, buildCount: 0, cacheHits: 0, maxBuildMs: 0 };
    }

    getPathBuildStats(): PathBuildStats {
        return { ...this.pathBuildStats };
    }

    // TODO: Daha sonra drawDrawElement ismini paintDrawElement yapmak daha iyi olacak. Garip duruyor...
    drawDrawElement(
        context: XDrawRenderingContext,
        draw: XDrawDrawElement,
        cameraScale: number,
        colorOverride?: string,
        minLineWidth = 0,
        range?: DrawPointRange,
        invertLightness = false,
    ) {
        if (draw.points.length === 0) {
            return;
        }
        const startIndex = range?.startIndex ?? 0;
        const endIndex = range?.endIndex ?? draw.points.length - 1;
        if (startIndex < 0 || endIndex < startIndex || endIndex >= draw.points.length) {
            return;
        }
        const sourceColor = colorOverride ?? ColorUtils.regularizeToHexColor(draw.color);
        const color = sourceColor && invertLightness && !colorOverride
            ? ColorUtils.invertLightness(sourceColor)
            : sourceColor;
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

    drawFillElement(context: XDrawRenderingContext, fill: XDrawFillElement, colorOverride?: string, invertLightness = false) {
        if (fill.rings.length === 0) {
            return;
        }
        const sourceColor = colorOverride ?? ColorUtils.regularizeToHexColor(fill.color);
        const color = sourceColor && invertLightness && !colorOverride
            ? ColorUtils.invertLightness(sourceColor)
            : sourceColor;
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

    drawTextElement(context: XDrawRenderingContext, textElement: XDrawTextElement, invertLightness = false) {
        const sourceColor = ColorUtils.regularizeToHexColor(textElement.color) || textElement.color;
        const color = invertLightness ? ColorUtils.invertLightness(sourceColor) : sourceColor;
        context.fillStyle = color;
        context.lineWidth = 1;
        context.font = `${textElement.fontWeight || "normal"} ${textElement.fontSize}px ${textElement.fontFamily || "sans-serif"}`;
        context.textBaseline = "top";
        context.fillText(textElement.text, textElement.position.x, textElement.position.y);
    }

    drawShapeElement(context: XDrawRenderingContext, shape: XDrawShapeElement, invertLightness = false, colorOverride?: string, minLineWidth = 0) {
        if (shape.width <= 0 || shape.height <= 0) return;
        const color = (value: string) => {
            const normalized = ColorUtils.regularizeToHexColor(value) || value;
            return colorOverride ?? (invertLightness ? ColorUtils.invertLightness(normalized) : normalized);
        };
        const path = new Path2D();
        if (shape.shape === "ellipse") {
            path.ellipse(shape.x + shape.width / 2, shape.y + shape.height / 2, shape.width / 2, shape.height / 2, 0, 0, Math.PI * 2);
        } else {
            path.rect(shape.x, shape.y, shape.width, shape.height);
        }
        context.save();
        try {
            context.lineJoin = "round";
            if (shape.fillColor) {
                context.fillStyle = color(shape.fillColor);
                context.fill(path);
            }
            context.strokeStyle = color(shape.color);
            context.lineWidth = Math.max(shape.strokeWidth, minLineWidth);
            context.stroke(path);
            const label = shape.label;
            if (!label?.text || colorOverride) return;
            context.clip(path);
            const factor = shape.shape === "ellipse" ? Math.SQRT1_2 : 1;
            const padding = Math.max(4, shape.strokeWidth / 2 + 2);
            const width = shape.width * factor - padding * 2;
            const height = shape.height * factor - padding * 2;
            if (width <= 0 || height <= 0) return;
            const centerX = shape.x + shape.width / 2;
            const centerY = shape.y + shape.height / 2;
            context.beginPath();
            context.rect(centerX - width / 2, centerY - height / 2, width, height);
            context.clip();
            context.font = `${label.fontWeight || "normal"} ${label.fontSize}px ${label.fontFamily}`;
            context.fillStyle = color(label.color);
            context.textAlign = "center";
            context.textBaseline = "top";
            const lines: string[] = [];
            for (const paragraph of label.text.split("\n")) {
                let line = "";
                for (const word of paragraph.split(/\s+/).filter(Boolean)) {
                    const candidate = line ? `${line} ${word}` : word;
                    if (context.measureText(candidate).width <= width) {
                        line = candidate;
                        continue;
                    }
                    if (line) lines.push(line);
                    line = "";
                    for (const character of word) {
                        if (line && context.measureText(line + character).width > width) {
                            lines.push(line);
                            line = "";
                        }
                        line += character;
                    }
                }
                lines.push(line);
            }
            const lineHeight = label.fontSize * 1.2;
            const visibleLines = lines.slice(0, Math.max(1, Math.floor(height / lineHeight)));
            const top = centerY - visibleLines.length * lineHeight / 2;
            visibleLines.forEach((line, index) => context.fillText(line, centerX, top + index * lineHeight));
        } finally {
            context.restore();
        }
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
            return { segments: this.measuredBuildDrawSegments(draw, cameraScale, minLineWidth, startIndex, endIndex).segments };
        }

        const cached = this.drawPathCache.get(draw.points);
        if (cached) {
            this.pathBuildStats.cacheHits++;
            return cached;
        }

        const built = this.measuredBuildDrawSegments(draw, cameraScale, minLineWidth, startIndex, endIndex);
        if (built.cacheable) {
            const cacheEntry = { segments: built.segments };
            this.drawPathCache.set(draw.points, cacheEntry);
            return cacheEntry;
        }
        return built;
    }

    private measuredBuildDrawSegments(
        draw: XDrawDrawElement,
        cameraScale: number,
        minLineWidth: number,
        startIndex: number,
        endIndex: number,
    ): { segments: DrawPathSegment[]; cacheable: boolean } {
        const start = performance.now();
        const built = this.buildDrawSegments(draw, cameraScale, minLineWidth, startIndex, endIndex);
        const elapsed = performance.now() - start;
        this.pathBuildStats.buildMs += elapsed;
        this.pathBuildStats.buildCount++;
        if (elapsed > this.pathBuildStats.maxBuildMs) {
            this.pathBuildStats.maxBuildMs = elapsed;
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
