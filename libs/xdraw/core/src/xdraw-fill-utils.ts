import type { XDrawDrawElement, XDrawElement, XDrawFillElement, XDrawLayer, XDrawPoint } from "./xdraw-data";

export class XdrawFillUtils {
    private static readonly FILL_MASK_ALPHA_THRESHOLD = 16;
    private static readonly FILL_BOUNDS_PADDING = 4;
    private static readonly FILL_MASK_DILATE_PX = 1;
    private static readonly FILL_SIMPLIFY_EPSILON = 0.75;

    public static fillDye(activeLayer: XDrawLayer, x: number, y: number, color: string): boolean {
        const fillElements = this.collectFloodFillElements(activeLayer.elements, x, y);
        if (fillElements.length === 0) {
            return false;
        }

        for (const element of fillElements) {
            element.color = color;
        }
        // Dolgu, mevcut cizgilerin altinda kalsin diye baslangica eklenir.
        activeLayer.elements.unshift(...fillElements);
        return true;
    }

    private static collectFloodFillElements(
        elements: XDrawElement[],
        worldX: number,
        worldY: number,
    ): XDrawFillElement[] {
        const mask = this.rasterizeFillMask(elements, worldX, worldY);
        if (!mask) {
            return [];
        }

        const fillPixels = this.floodFillMask(mask.imageData, mask.startX, mask.startY);
        if (!fillPixels) {
            return [];
        }

        return this.convertFilledPixelsToFillElements(
            fillPixels,
            mask.width,
            mask.height,
            mask.originX,
            mask.originY,
        );
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
            if (element.type === "fill") {
                const fillElement = element as XDrawFillElement;
                if (fillElement.rings.length === 0) {
                    continue;
                }
                const path = new Path2D();
                for (const ring of fillElement.rings) {
                    if (ring.length === 0) {
                        continue;
                    }
                    path.moveTo(ring[0].x, ring[0].y);
                    for (let i = 1; i < ring.length; i++) {
                        path.lineTo(ring[i].x, ring[i].y);
                    }
                    path.closePath();
                }
                context.fill(path, "evenodd");
                continue;
            }

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

    private static convertFilledPixelsToFillElements(
        fillPixels: Uint8Array,
        width: number,
        height: number,
        originX: number,
        originY: number,
    ): XDrawFillElement[] {
        const dilated = this.dilateMask(fillPixels, width, height, this.FILL_MASK_DILATE_PX);
        const rawRings = this.traceMaskContours(dilated, width, height);

        const rings = rawRings
            .map((ring) => this.simplifyRing(ring, this.FILL_SIMPLIFY_EPSILON))
            .filter((ring) => ring.length >= 3)
            .map((ring) => ring.map((point) => ({ x: originX + point.x, y: originY + point.y })));

        if (rings.length === 0) {
            return [];
        }

        return [{
            type: "fill",
            color: "#000000",
            rings,
            id: this.generateUniqueId(),
        }];
    }

    private static dilateMask(mask: Uint8Array, width: number, height: number, iterations: number): Uint8Array {
        let current = mask;
        for (let iteration = 0; iteration < iterations; iteration++) {
            const next = new Uint8Array(current);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const index = y * width + x;
                    if (current[index] === 1) {
                        continue;
                    }
                    const left = x > 0 && current[index - 1] === 1;
                    const right = x + 1 < width && current[index + 1] === 1;
                    const up = y > 0 && current[index - width] === 1;
                    const down = y + 1 < height && current[index + width] === 1;
                    if (left || right || up || down) {
                        next[index] = 1;
                    }
                }
            }
            current = next;
        }
        return current;
    }

    // Mask kenarlarini (piksel koseleri) izleyerek kapali halkalar cikarir.
    // Evenodd doldurma kurali sayesinde dis sinir/delik ayrimi yapmaya gerek yok;
    // tum halkalar duz bir liste olarak dondurulur.
    private static traceMaskContours(mask: Uint8Array, width: number, height: number): XDrawPoint[][] {
        const isFilled = (x: number, y: number): boolean =>
            x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;

        const edgesFrom = new Map<string, Array<[number, number]>>();
        const addEdge = (x1: number, y1: number, x2: number, y2: number): void => {
            const key = `${x1},${y1}`;
            const list = edgesFrom.get(key);
            if (list) {
                list.push([x2, y2]);
            } else {
                edgesFrom.set(key, [[x2, y2]]);
            }
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (!isFilled(x, y)) {
                    continue;
                }
                if (!isFilled(x, y - 1)) addEdge(x, y, x + 1, y);
                if (!isFilled(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
                if (!isFilled(x - 1, y)) addEdge(x, y + 1, x, y);
                if (!isFilled(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
            }
        }

        const rings: XDrawPoint[][] = [];
        const maxSteps = width * height * 4 + 10;

        for (const [startKey, list] of edgesFrom) {
            while (list.length > 0) {
                const [startX, startY] = startKey.split(",").map(Number);
                const ring: XDrawPoint[] = [];
                let cx = startX;
                let cy = startY;
                let steps = 0;

                do {
                    ring.push({ x: cx, y: cy });
                    const options = edgesFrom.get(`${cx},${cy}`);
                    if (!options || options.length === 0) {
                        break;
                    }
                    const [nextX, nextY] = options.shift()!;
                    cx = nextX;
                    cy = nextY;
                    steps++;
                } while (!(cx === startX && cy === startY) && steps < maxSteps);

                if (ring.length >= 3) {
                    rings.push(ring);
                }
            }
        }

        return rings;
    }

    private static removeCollinearPoints(ring: XDrawPoint[]): XDrawPoint[] {
        const count = ring.length;
        if (count <= 2) {
            return ring;
        }

        const result: XDrawPoint[] = [];
        for (let i = 0; i < count; i++) {
            const prev = ring[(i - 1 + count) % count];
            const cur = ring[i];
            const next = ring[(i + 1) % count];
            const dx1 = cur.x - prev.x;
            const dy1 = cur.y - prev.y;
            const dx2 = next.x - cur.x;
            const dy2 = next.y - cur.y;
            if (dx1 * dy2 - dy1 * dx2 !== 0) {
                result.push(cur);
            }
        }

        return result.length >= 3 ? result : ring;
    }

    private static perpendicularDistance(point: XDrawPoint, a: XDrawPoint, b: XDrawPoint): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq === 0) {
            const ddx = point.x - a.x;
            const ddy = point.y - a.y;
            return Math.sqrt(ddx * ddx + ddy * ddy);
        }

        const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
        const projX = a.x + t * dx;
        const projY = a.y + t * dy;
        const ddx = point.x - projX;
        const ddy = point.y - projY;
        return Math.sqrt(ddx * ddx + ddy * ddy);
    }

    // Ramer-Douglas-Peucker (acik polyline uzerinde).
    private static simplifyOpenPath(points: XDrawPoint[], epsilon: number): XDrawPoint[] {
        if (points.length <= 2) {
            return points;
        }

        const first = points[0];
        const last = points[points.length - 1];
        let maxDist = 0;
        let maxIndex = 0;
        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.perpendicularDistance(points[i], first, last);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }

        if (maxDist <= epsilon) {
            return [first, last];
        }

        const left = this.simplifyOpenPath(points.slice(0, maxIndex + 1), epsilon);
        const right = this.simplifyOpenPath(points.slice(maxIndex), epsilon);
        return left.slice(0, -1).concat(right);
    }

    // Kapali halkayi en uzak iki noktasindan ikiye bolup her parcayi RDP ile sadelestirir.
    private static simplifyRing(ring: XDrawPoint[], epsilon: number): XDrawPoint[] {
        const reduced = this.removeCollinearPoints(ring);
        if (reduced.length <= 3) {
            return reduced;
        }

        let maxDistSq = -1;
        let splitA = 0;
        let splitB = 1;
        for (let i = 0; i < reduced.length; i++) {
            for (let j = i + 1; j < reduced.length; j++) {
                const dx = reduced[i].x - reduced[j].x;
                const dy = reduced[i].y - reduced[j].y;
                const distSq = dx * dx + dy * dy;
                if (distSq > maxDistSq) {
                    maxDistSq = distSq;
                    splitA = i;
                    splitB = j;
                }
            }
        }

        const chainA = reduced.slice(splitA, splitB + 1);
        const chainB = reduced.slice(splitB).concat(reduced.slice(0, splitA + 1));
        const simplifiedA = this.simplifyOpenPath(chainA, epsilon);
        const simplifiedB = this.simplifyOpenPath(chainB, epsilon);
        const merged = simplifiedA.slice(0, -1).concat(simplifiedB.slice(0, -1));
        return merged.length >= 3 ? merged : reduced;
    }

    private static findBoundingBox(elements: XDrawElement[]): { minX: number; minY: number; maxX: number; maxY: number } {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const element of elements) {
            if (element.type === "draw") {
                const drawElement = element as XDrawDrawElement;
                for (const point of drawElement.points) {
                    if (point.x < minX) minX = point.x;
                    if (point.y < minY) minY = point.y;
                    if (point.x > maxX) maxX = point.x;
                    if (point.y > maxY) maxY = point.y;
                }
                continue;
            }
            if (element.type === "fill") {
                const fillElement = element as XDrawFillElement;
                for (const ring of fillElement.rings) {
                    for (const point of ring) {
                        if (point.x < minX) minX = point.x;
                        if (point.y < minY) minY = point.y;
                        if (point.x > maxX) maxX = point.x;
                        if (point.y > maxY) maxY = point.y;
                    }
                }
            }
        }

        return { minX, minY, maxX, maxY };
    }

    private static generateUniqueId(): string {
        return "id-" + Math.random().toString(36).slice(2, 18);
    }
}
