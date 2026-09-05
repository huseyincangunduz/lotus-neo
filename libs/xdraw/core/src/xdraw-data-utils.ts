import type { XDrawCanvasCamera, XDrawData, XDrawDrawElement, XDrawElement, XDrawFillElement, XDrawFillMask, XDrawLayer, XDrawTextElement } from "./xdraw-data";
import { XdrawFillUtils } from "./xdraw-fill-utils";

export interface XDrawElementCropData {
    layerId: string;
    layerOpacity: number;
    element?: XDrawElement;
    elementId: string;
    elementType: string;
    points?: Array<{ x: number; y: number; size: number }>;
    pointStartIndex?: number;
    pointEndIndex?: number;
    rings?: Array<Array<{ x: number; y: number }>>;
    color?: string;
    partial?: boolean;
}

export type OnFoundCallback = (cropData: XDrawElementCropData) => void;

export class XdrawDataUtils {

    private static readonly MIN_TELEPORT_DISTANCE = 250;


    /**
     * XDrawData nesnesini derinlemesine kopyalar.
     * @param data Kopyalanacak XDrawData nesnesi.
     * @returns Yeni bir XDrawData nesnesi.
     */
    public static deepCopyXDrawData(data: XDrawData): XDrawData {
        return JSON.parse(JSON.stringify(data));
    }

    public static serializeXDrawData(data: XDrawData, optimize = false): string {
        return JSON.stringify(optimize ? this.optimizeXDrawData(data) : data);
    }

    public static optimizeXDrawData(data: XDrawData): XDrawData {
        return {
            layers: data.layers.map((layer) => ({
                ...layer,
                elements: this.mergeAdjacentDrawElements(layer.elements),
            })),
        };
    }

    private static mergeAdjacentDrawElements(elements: XDrawElement[]): XDrawElement[] {
        const optimized: XDrawElement[] = [];
        for (const element of elements) {
            const previous = optimized[optimized.length - 1];
            if (
                previous?.type === "draw" &&
                element.type === "draw" &&
                (previous as XDrawDrawElement).color === (element as XDrawDrawElement).color
            ) {
                const previousDraw = previous as XDrawDrawElement;
                const currentDraw = element as XDrawDrawElement;
                previousDraw.points = previousDraw.points.concat(
                    currentDraw.points.map((point, index) => index === 0 ? { ...point, breakBefore: true } : point),
                );
                previousDraw.finalized = previousDraw.finalized !== false && currentDraw.finalized !== false;
                continue;
            }
            optimized.push({ ...element });
        }
        return optimized;
    }

    // Crop dataları cachelemek güzel ama asıl yoğunluk kanvasa çizdirme sırasında oluyor. performans düşmedi ama yine aynı şekilde çok element olmasından dolayı yine fps düşüşü var...
    // static cropDataMap = new Map<string, XDrawElementCropData[]>();

    // Kameranin gordugu dunya dikdortgeni disindaki elementleri eleyerek render yukunu azaltir.
    // Noktalar dunya koordinatinda kalir; kamera donusumu render sirasinda uygulanir.
    public static cropXDrawData(data: XDrawData, cam: XDrawCanvasCamera, screenWidth: number, screenHeight: number, onFound?: OnFoundCallback): void {


        const worldLeft = cam.x;
        const worldTop = cam.y;
        const worldRight = cam.x + screenWidth / cam.scale;
        const worldBottom = cam.y + screenHeight / cam.scale;
        // const boundKey = [worldLeft, worldTop, worldRight, worldBottom].join("-");
        // if (this.cropDataMap.has(boundKey)) {
        //     const cachedData = this.cropDataMap.get(boundKey)!;
        //     for (const cropData of cachedData) {
        //         onFound?.(cropData);
        //     }
        //     return;
        // }

        // const cropKeys = this.cropDataMap.keys();
        // for (const key of cropKeys) {
        //     const [left, top, right, bottom] = key.split("-").map(Number);
        //     if (left > worldLeft && top > worldTop && right < worldRight && bottom < worldBottom) {
        //         // const cachedData = this.cropDataMap.get(key)!;
        //         const currentCropElementsFoundData = this.cropDataMap.get(key)!;
        //         this.cropDataMap.set(boundKey, currentCropElementsFoundData);
        //         for (const cropData of currentCropElementsFoundData) {
        //             onFound?.(cropData);
        //         }
        //         return;
        //     }
        // }

        for (const layer of data.layers) {
            if (layer.visible === false || layer.opacity === 0) {
                continue; // Görünmez katmanları atla
            }
            this.cropXDrawDataElements(layer.elements, worldLeft, worldTop, worldRight, worldBottom, { layerId: layer.id, layerOpacity: layer.opacity },
                onFound,
                // (a) => {
                // if (!this.cropDataMap.has(boundKey)) {
                //     this.cropDataMap.set(boundKey, []);
                // }
                // this.cropDataMap.get(boundKey)!.push(a);
                // onFound?.(a);
                // }
            );
        }
    }
    // Dünyanın en mal şeysi.... ben malım. bu sefer hesaplamaktan çok cachelemek performansı düşürdü aw
    // public static readonly pointCropPathMap: Map<string, boolean> = new Map();

    public static cropXDrawDataElements(elements: XDrawElement[], left: number, top: number, right: number, bottom: number, initialFoundElement: Partial<XDrawElementCropData>, onFound?: OnFoundCallback): void {
        const cropCondition = (point: { x: number; y: number }) => {
            const status = point.x >= left && point.x <= right &&
                point.y >= top && point.y <= bottom;
            return status;
        };
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (element.type === "fill") {
                const fillElement = element as XDrawFillElement;
                let isVisible = false;
                for (const ring of fillElement.rings) {
                    for (const point of ring) {
                        if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
                            isVisible = true;
                            break;
                        }
                    }
                    if (isVisible) {
                        break;
                    }
                }
                if (isVisible && onFound) {
                    onFound({
                        ...initialFoundElement,
                        elementId: fillElement.id,
                        elementType: fillElement.type,
                        element: fillElement,
                        rings: fillElement.rings,
                        color: fillElement.color,
                        partial: false
                    } as any as XDrawElementCropData);
                }
                continue;
            }
            if (element.type === "draw") {

                // 
                const drawElement = element as XDrawDrawElement;
                const pointCount = drawElement.points.length;
                if (pointCount === 0) {
                    continue;
                }
                let startIndex = -1;
                let endIndex = -1;
                const scanCount = Math.ceil(pointCount / 2);
                for (let i = 0; i < scanCount; i++) {
                    const lastIndex = pointCount - 1 - i;
                    if (startIndex === -1 && cropCondition(drawElement.points[i])) {
                        startIndex = i;
                    }
                    if (endIndex === -1 && cropCondition(drawElement.points[lastIndex])) {
                        endIndex = lastIndex;
                    }
                    if ((startIndex !== -1 && endIndex !== -1)) {
                        break;
                    }
                }
                let partial = false;
                if ((startIndex === -1 && endIndex === -1)) {
                    continue;

                }

                if (startIndex === -1 || endIndex === -1) {
                    startIndex = startIndex === -1 ? 0 : startIndex;
                    endIndex = endIndex === -1 ? pointCount - 1 : endIndex;
                }

                partial = !(startIndex === 0 && endIndex === pointCount - 1);
                if (onFound) {

                    onFound({
                        ...initialFoundElement,
                        element: drawElement,
                        elementId: drawElement.id,
                        elementType: drawElement.type,
                        points: drawElement.points,
                        pointStartIndex: startIndex,
                        pointEndIndex: endIndex,
                        color: drawElement.color,
                        partial: partial,
                    } as any as XDrawElementCropData);
                }
            }
        }
    }

    public static removePointsAt(elements: XDrawElement[], x: number, y: number, radius: number): {elements: XDrawElement[], hasChanges: boolean} {
        const newElements: XDrawElement[] = [];
        let hasChanges = false;
        for (const element of elements) {
            switch (element.type) {
                case "draw":
                    const drawElement = element as XDrawDrawElement;
                    const filteredPoints: XDrawDrawElement["points"] = [];
                    let removedSincePreviousPoint = false;
                    for (const point of drawElement.points) {
                        const dx = point.x - x;
                        const dy = point.y - y;
                        if ((dx * dx + dy * dy) <= (radius * radius)) {
                            removedSincePreviousPoint = true;
                            continue;
                        }

                        filteredPoints.push(
                            removedSincePreviousPoint ? { ...point, breakBefore: true } : point,
                        );
                        removedSincePreviousPoint = false;
                    }
                    if (filteredPoints.length > 0) {
                        newElements.push({ ...drawElement, points: filteredPoints } as XDrawDrawElement);
                    }
                    if (filteredPoints.length !== drawElement.points.length) {
                        hasChanges = true;
                    }
                    break;
                case "fill":
                    const fillElement = element as XDrawFillElement;
                    const touchesEraser = fillElement.rings.some((ring) => ring.some((point) => {
                        const dx = point.x - x;
                        const dy = point.y - y;
                        return (dx * dx + dy * dy) <= (radius * radius);
                    }));
                    if (!touchesEraser) {
                        newElements.push(fillElement);
                    } else {
                        hasChanges = true;
                    }
                    break;
                case "text":
                    const textElement = element as XDrawTextElement;
                    const dx = textElement.position.x - x;
                    const dy = textElement.position.y - y;
                    if ((dx * dx + dy * dy) > (radius * radius)) {
                        newElements.push(textElement);
                    } else {
                        hasChanges = true;
                    }
                    break;
            }
        }
        return { elements: newElements, hasChanges };


    }

    public static generateUniqueId(): string {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        console.warn("crypto.randomUUID() is not available. Falling back to a less secure method for generating unique IDs.");
        // 2. HTTP yerel ağ testi veya desteklenmeyen ortamlar için Fallback
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        // return 'id-' + Math.random().toString(36).slice(2, 18);
    }

    public static fillDye(activeLayer: XDrawLayer, mask: XDrawFillMask, x: number, y: number, color: string): boolean {
        return XdrawFillUtils.fillDye(activeLayer, mask, x, y, color);
    }


    // Bu fonksiyon, verilen XDrawElement dizisindeki tüm "draw" ve "fill" tipindeki elementlerin minimum ve maksimum x ve y koordinatlarını hesaplar.
    public static findBoundingBox(elements: XDrawElement[], maxWorldX?: number, maxWorldY?: number): { minX: number, minY: number, maxX: number, maxY: number } {
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
            } else if (element.type === "fill") {
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

        minX = Math.max(0, minX);
        minY = Math.max(0, minY);
        maxX = maxWorldX !== undefined ? Math.min(maxWorldX, maxX) : maxX;
        maxY = maxWorldY !== undefined ? Math.min(maxWorldY, maxY) : maxY;

        return { minX, minY, maxX, maxY };
    }


    static findNearestPointInElement(data: XDrawData, x: number, y: number, _scale: number, rotationDegrees: number): { x: number, y: number, element: XDrawElement, distance: number } | null {
        const radians = rotationDegrees * (Math.PI / 180);
        const directionX = Math.cos(radians);
        const directionY = Math.sin(radians);
        let nearest: { x: number, y: number, element: XDrawElement, distance: number } | null = null;

        const considerPoint = (point: { x: number; y: number }, element: XDrawElement): void => {
            const deltaX = point.x - x;
            const deltaY = point.y - y;
            const forwardDistance = deltaX * directionX + deltaY * directionY;
            const sidewaysDistance = Math.abs(deltaX * directionY - deltaY * directionX);
            const distanceSquared = deltaX * deltaX + deltaY * deltaY;

            // 45 derecelik yon konisi: ayni yondeki, fakat cok caprazdaki noktalar elenir.
            if (forwardDistance <= 0 ||
                sidewaysDistance > forwardDistance ||
                distanceSquared < XdrawDataUtils.MIN_TELEPORT_DISTANCE ** 2) {
                return;
            }

            const distance = Math.sqrt(distanceSquared);
            if (!nearest || distance < nearest.distance) {
                nearest = { x: point.x, y: point.y, element, distance };
            }
        };

        for (const layer of data.layers) {
            if (layer.visible === false || layer.opacity === 0) {
                continue;
            }
            for (const element of layer.elements) {
                if (element.type === "draw") {
                    for (const point of (element as XDrawDrawElement).points) {
                        considerPoint(point, element);
                    }
                } else if (element.type === "fill") {
                    for (const ring of (element as XDrawFillElement).rings) {
                        for (const point of ring) {
                            considerPoint(point, element);
                        }
                    }
                }
            }
        }

        return nearest;

    }

}