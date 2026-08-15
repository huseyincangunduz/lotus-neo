import type { XDrawDrawElement, XDrawElement, XDrawFillElement, XDrawLayer, XDrawPoint } from "./xdraw-data";

export class XdrawFillUtils {
    private static readonly FILL_MASK_ALPHA_THRESHOLD = 16;
    private static readonly FILL_BOUNDS_PADDING = 4;
    private static readonly FILL_MASK_DILATE_PX = 1;
    private static readonly FILL_SIMPLIFY_EPSILON = 0.75;
    private static internalMaskCanvas: HTMLCanvasElement | null = null;

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
        if (!this.internalMaskCanvas) {
            this.internalMaskCanvas = document.createElement("canvas");
        }
        const canvas = this.internalMaskCanvas;
        // const canvas = document.createElement("canvas");
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
        // Sabit boyutlu tipli dizi: push/pop ile buyuyen number[] yerine yeniden tahsis olmadan calisir.
        const stack = new Int32Array(width * height);
        let stackSize = 0;
        stack[stackSize++] = startY * width + startX;
        visited[startY * width + startX] = 1;

        while (stackSize > 0) {
            const pixelIndex = stack[--stackSize];
            const x = pixelIndex % width;
            const y = (pixelIndex - x) / width;

            if (x > 0) {
                const neighborIndex = pixelIndex - 1;
                if (visited[neighborIndex] === 0 && data[neighborIndex * 4 + 3] <= threshold) {
                    visited[neighborIndex] = 1;
                    stack[stackSize++] = neighborIndex;
                }
            }
            if (x + 1 < width) {
                const neighborIndex = pixelIndex + 1;
                if (visited[neighborIndex] === 0 && data[neighborIndex * 4 + 3] <= threshold) {
                    visited[neighborIndex] = 1;
                    stack[stackSize++] = neighborIndex;
                }
            }
            if (y > 0) {
                const neighborIndex = pixelIndex - width;
                if (visited[neighborIndex] === 0 && data[neighborIndex * 4 + 3] <= threshold) {
                    visited[neighborIndex] = 1;
                    stack[stackSize++] = neighborIndex;
                }
            }
            if (y + 1 < height) {
                const neighborIndex = pixelIndex + width;
                if (visited[neighborIndex] === 0 && data[neighborIndex * 4 + 3] <= threshold) {
                    visited[neighborIndex] = 1;
                    stack[stackSize++] = neighborIndex;
                }
            }
        }

        return visited;
    }

    private static convertFilledPixelsToFillElements(
        fillPixels: Uint8Array,
        width: number,
        height: number,
        originX: number,
        originY: number,
    ): XDrawFillElement[] {
        const dilated = this.dilateMask(fillPixels, width, height, this.FILL_MASK_DILATE_PX);

        const rings: XDrawPoint[][] = [];

        void this.traceMaskContours(
            dilated,
            width,
            height,
            rawRing => {
                const simplifiedRing = this.simplifyRing(rawRing, this.FILL_SIMPLIFY_EPSILON);
                if (simplifiedRing.length >= 3) {
                    rings.push(simplifiedRing.map((point) => ({ x: originX + point.x, y: originY + point.y })));
                }
            }
        );


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
    private static traceMaskContours(mask: Uint8Array, width: number, height: number, onRingCallback: (ring: XDrawPoint[]) => void): XDrawPoint[][] {
        const isFilled = (x: number, y: number): boolean =>
            x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;

        // Kose koordinatlari 0..width / 0..height araliginda; string anahtar yerine
        // tek tam sayiya kodlanir (alloc/parse maliyeti olmadan Map anahtari olarak kullanilir).
        const cornerStride = width + 1;
        const encodeCorner = (x: number, y: number): number => y * cornerStride + x;

        const edgesFrom = new Map<number, number[]>();
        const addEdge = (x1: number, y1: number, x2: number, y2: number): void => {
            const key = encodeCorner(x1, y1);
            const target = encodeCorner(x2, y2);
            const list = edgesFrom.get(key);
            if (list) {
                list.push(target);
            } else {
                edgesFrom.set(key, [target]);
            }
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Eğer o nokta dolu değilse, bir sonraki piksele geç.
                if (!isFilled(x, y)) {
                    continue;
                }
                // Dolu pikselin dört kenarını kontrol et ve boş olan kenarları ekle.
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
                const startX = startKey % cornerStride;
                const startY = (startKey - startX) / cornerStride;
                const ring: XDrawPoint[] = [];
                let cx = startX;
                let cy = startY;
                let steps = 0;

                do {
                    ring.push({ x: cx, y: cy });
                    const options = edgesFrom.get(encodeCorner(cx, cy));
                    if (!options || options.length === 0) {
                        break;
                    }
                    const next = options.shift()!;
                    cx = next % cornerStride;
                    cy = (next - cx) / cornerStride;
                    steps++;
                } while (!(cx === startX && cy === startY) && steps < maxSteps);

                if (ring.length >= 3) {
                    rings.push(ring);
                    onRingCallback(ring);
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
