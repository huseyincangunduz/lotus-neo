import type { XDrawDrawElement, XDrawElement, XDrawLayer } from "./xdraw-data";

export class XdrawFillUtils {
    private static readonly FILL_MASK_ALPHA_THRESHOLD = 16;
    private static readonly FILL_BOUNDS_PADDING = 4;

    public static allEmptyFillablePoints(worldX: number, worldY: number, elements: XDrawElement[]): Map<number, Map<number, boolean>> {
        const emptyPointsMatrix: Map<number, Map<number, boolean>> = new Map();
        const allPoints = elements.flatMap((element) => {
            if (element.type === "draw") {
                const drawElement = element as XDrawDrawElement;
                return drawElement.points.map((point) => ({ x: point.x, y: point.y, size: point.size }));
            }
            return [];
        });

        const radius = 5;
        const nearbyPoints = allPoints.filter((point) => {
            const dx = point.x - worldX;
            const dy = point.y - worldY;
            return (dx * dx + dy * dy) <= (radius * radius);
        });

        for (const point of nearbyPoints) {
            if (!emptyPointsMatrix.has(point.x)) {
                emptyPointsMatrix.set(point.x, new Map());
            }
            const yMap = emptyPointsMatrix.get(point.x)!;
            if (!yMap.has(point.y)) {
                yMap.set(point.y, true);
            }
        }

        return emptyPointsMatrix;
    }

    public static fillDye(activeLayer: XDrawLayer, x: number, y: number, color: string): boolean {
        const fillResult = this.collectFloodFillSegments(activeLayer.elements, x, y);
        if (!fillResult || fillResult.segments.length === 0) {
            return false;
        }

        for (const segment of fillResult.segments) {
            activeLayer.elements.push({
                type: "draw",
                color,
                points: segment.points,
                id: this.generateUniqueId(),
            } as XDrawDrawElement);
        }

        return true;
    }

    public static fillPoints(activeLayer: XDrawLayer, fillablePoints: Map<number, Map<number, boolean>>, color: string): void {
        for (const [x, yMap] of fillablePoints.entries()) {
            for (const y of yMap.keys()) {
                activeLayer.elements.push({
                    type: "draw",
                    color,
                    points: [{ x, y, size: 10 }],
                    id: this.generateUniqueId(),
                } as XDrawDrawElement);
            }
        }
    }

    private static collectFloodFillSegments(
        elements: XDrawElement[],
        worldX: number,
        worldY: number,
    ): { segments: XDrawDrawElement[] } | null {
        const mask = this.rasterizeFillMask(elements, worldX, worldY);
        if (!mask) {
            return null;
        }

        const fillPixels = this.floodFillMask(mask.imageData, mask.startX, mask.startY);
        if (!fillPixels) {
            return null;
        }

        return {
            segments: this.convertFilledPixelsToDrawElements(
                fillPixels,
                mask.width,
                mask.height,
                mask.originX,
                mask.originY,
            ),
        };
    }

    private static rasterizeFillMask(
        elements: XDrawElement[],
        worldX: number,
        worldY: number,
    ): {
        imageData: ImageData;
        width: number;
        height: number;
        originX: number;
        originY: number;
        startX: number;
        startY: number;
    } | null {
        const bounds = this.findBoundingBox(elements);
        if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.maxY)) {
            return null;
        }

        const padding = this.FILL_BOUNDS_PADDING;
        const minX = Math.floor(Math.min(bounds.minX, worldX) - padding);
        const minY = Math.floor(Math.min(bounds.minY, worldY) - padding);
        const maxX = Math.ceil(Math.max(bounds.maxX, worldX) + padding);
        const maxY = Math.ceil(Math.max(bounds.maxY, worldY) + padding);
        const width = Math.max(1, maxX - minX + 1);
        const height = Math.max(1, maxY - minY + 1);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
            return null;
        }

        context.clearRect(0, 0, width, height);
        context.setTransform(1, 0, 0, 1, -minX, -minY);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = "#000000";
        context.fillStyle = "#000000";

        for (const element of elements) {
            if (element.type !== "draw") {
                continue;
            }

            const drawElement = element as XDrawDrawElement;
            if (drawElement.points.length === 0) {
                continue;
            }

            const firstPoint = drawElement.points[0];
            if (drawElement.points.length === 1) {
                context.beginPath();
                context.arc(firstPoint.x, firstPoint.y, Math.max(0.5, firstPoint.size / 2), 0, Math.PI * 2);
                context.fill();
                continue;
            }

            context.lineWidth = Math.max(1, firstPoint.size);
            context.beginPath();
            context.moveTo(firstPoint.x, firstPoint.y);
            for (let i = 1; i < drawElement.points.length; i++) {
                context.lineTo(drawElement.points[i].x, drawElement.points[i].y);
            }
            context.stroke();
        }

        const startX = Math.round(worldX - minX);
        const startY = Math.round(worldY - minY);
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
            return null;
        }

        return {
            imageData: context.getImageData(0, 0, width, height),
            width,
            height,
            originX: minX,
            originY: minY,
            startX,
            startY,
        };
    }

    private static floodFillMask(imageData: ImageData, startX: number, startY: number): Uint8Array | null {
        const { width, height, data } = imageData;
        const threshold = this.FILL_MASK_ALPHA_THRESHOLD;
        const startIndex = (startY * width + startX) * 4 + 3;
        if (data[startIndex] > threshold) {
            return null;
        }

        const visited = new Uint8Array(width * height);
        const stack: number[] = [startY * width + startX];
        visited[startY * width + startX] = 1;

        while (stack.length > 0) {
            const pixelIndex = stack.pop()!;
            const x = pixelIndex % width;
            const y = Math.floor(pixelIndex / width);

            if (x > 0) {
                this.visitFillNeighbor(x - 1, y, width, data, threshold, visited, stack);
            }
            if (x + 1 < width) {
                this.visitFillNeighbor(x + 1, y, width, data, threshold, visited, stack);
            }
            if (y > 0) {
                this.visitFillNeighbor(x, y - 1, width, data, threshold, visited, stack);
            }
            if (y + 1 < height) {
                this.visitFillNeighbor(x, y + 1, width, data, threshold, visited, stack);
            }
        }

        return visited;
    }

    private static visitFillNeighbor(
        x: number,
        y: number,
        width: number,
        pixels: Uint8ClampedArray,
        threshold: number,
        visited: Uint8Array,
        stack: number[],
    ): void {
        const pixelIndex = y * width + x;
        if (visited[pixelIndex] === 1) {
            return;
        }

        const alphaIndex = pixelIndex * 4 + 3;
        if (pixels[alphaIndex] > threshold) {
            return;
        }

        visited[pixelIndex] = 1;
        stack.push(pixelIndex);
    }

    private static convertFilledPixelsToDrawElements(
        fillPixels: Uint8Array,
        width: number,
        height: number,
        originX: number,
        originY: number,
    ): XDrawDrawElement[] {
        type FillRun = { y: number; startX: number; endX: number };
        type FillChain = {
            points: Array<{ x: number; y: number; size: number }>;
            lastRun: FillRun;
        };

        const runs = this.extractFillRuns(fillPixels, width, height);
        const completedChains: FillChain[] = [];
        let activeChains: FillChain[] = [];

        for (const rowRuns of runs) {
            const nextChains: FillChain[] = [];
            const usedActiveChains = new Set<FillChain>();

            for (const run of rowRuns) {
                const candidates = activeChains.filter((chain) =>
                    !usedActiveChains.has(chain) &&
                    chain.lastRun.y === run.y - 1 &&
                    this.fillRunsOverlap(chain.lastRun, run),
                );

                if (candidates.length !== 1) {
                    nextChains.push({
                        points: this.createRunPoints(run, originX, originY),
                        lastRun: run,
                    });
                    continue;
                }

                const chain = candidates[0];
                usedActiveChains.add(chain);
                this.appendRunToChain(chain, run, originX, originY);
                nextChains.push(chain);
            }

            for (const chain of activeChains) {
                if (!usedActiveChains.has(chain)) {
                    completedChains.push(chain);
                }
            }

            activeChains = nextChains;
        }

        completedChains.push(...activeChains);

        return completedChains
            .filter((chain) => chain.points.length > 0)
            .map((chain) => ({
                type: "draw" as const,
                color: "#000000",
                points: chain.points,
                id: this.generateUniqueId(),
            }));
    }

    private static extractFillRuns(fillPixels: Uint8Array, width: number, height: number): Array<Array<{ y: number; startX: number; endX: number }>> {
        const runs: Array<Array<{ y: number; startX: number; endX: number }>> = [];

        for (let y = 0; y < height; y++) {
            const rowRuns: Array<{ y: number; startX: number; endX: number }> = [];
            let x = 0;
            while (x < width) {
                if (fillPixels[y * width + x] === 0) {
                    x++;
                    continue;
                }

                const startX = x;
                while (x + 1 < width && fillPixels[y * width + x + 1] === 1) {
                    x++;
                }

                rowRuns.push({ y, startX, endX: x });
                x++;
            }

            if (rowRuns.length > 0) {
                runs.push(rowRuns);
            }
        }

        return runs;
    }

    private static fillRunsOverlap(
        left: { startX: number; endX: number },
        right: { startX: number; endX: number },
    ): boolean {
        return left.startX <= right.endX && right.startX <= left.endX;
    }

    private static appendRunToChain(
        chain: { points: Array<{ x: number; y: number; size: number }>; lastRun: { y: number; startX: number; endX: number } },
        run: { y: number; startX: number; endX: number },
        originX: number,
        originY: number,
    ): void {
        const previousRun = chain.lastRun;
        const lastPoint = chain.points[chain.points.length - 1];
        const overlapStart = Math.max(previousRun.startX, run.startX);
        const overlapEnd = Math.min(previousRun.endX, run.endX);
        const connectorX = Math.max(overlapStart, Math.min(overlapEnd, lastPoint.x - originX));

        if (lastPoint.x !== originX + connectorX || lastPoint.y !== originY + previousRun.y) {
            chain.points.push(this.createFillPoint(connectorX, previousRun.y, originX, originY));
        }

        chain.points.push(this.createFillPoint(connectorX, run.y, originX, originY));

        const distanceToStart = Math.abs(connectorX - run.startX);
        const distanceToEnd = Math.abs(run.endX - connectorX);
        if (distanceToStart <= distanceToEnd) {
            if (connectorX !== run.startX) {
                chain.points.push(this.createFillPoint(run.startX, run.y, originX, originY));
            }
            if (run.startX !== run.endX) {
                chain.points.push(this.createFillPoint(run.endX, run.y, originX, originY));
            }
        } else {
            if (connectorX !== run.endX) {
                chain.points.push(this.createFillPoint(run.endX, run.y, originX, originY));
            }
            if (run.startX !== run.endX) {
                chain.points.push(this.createFillPoint(run.startX, run.y, originX, originY));
            }
        }

        chain.lastRun = run;
    }

    private static createRunPoints(
        run: { y: number; startX: number; endX: number },
        originX: number,
        originY: number,
    ): Array<{ x: number; y: number; size: number }> {
        if (run.startX === run.endX) {
            return [this.createFillPoint(run.startX, run.y, originX, originY)];
        }

        return [
            this.createFillPoint(run.startX, run.y, originX, originY),
            this.createFillPoint(run.endX, run.y, originX, originY),
        ];
    }

    private static createFillPoint(x: number, y: number, originX: number, originY: number): { x: number; y: number; size: number } {
        return { x: originX + x, y: originY + y, size: 1 };
    }

    private static findBoundingBox(elements: XDrawElement[]): { minX: number; minY: number; maxX: number; maxY: number } {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const element of elements) {
            if (element.type !== "draw") {
                continue;
            }
            const drawElement = element as XDrawDrawElement;
            for (const point of drawElement.points) {
                if (point.x < minX) minX = point.x;
                if (point.y < minY) minY = point.y;
                if (point.x > maxX) maxX = point.x;
                if (point.y > maxY) maxY = point.y;
            }
        }

        return { minX, minY, maxX, maxY };
    }

    private static generateUniqueId(): string {
        return "id-" + Math.random().toString(36).slice(2, 18);
    }
}
