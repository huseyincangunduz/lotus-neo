import type { XDrawCanvasCamera, XDrawData, XDrawDrawElement, XDrawElement, XDrawFillElement, XDrawFillMask, XDrawLayer } from "./xdraw-data";
import { XdrawFillUtils } from "./xdraw-fill-utils";

export interface XDrawElementCropData {
    layerId: string;
    layerOpacity: number;
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



    /**
     * XDrawData nesnesini derinlemesine kopyalar.
     * @param data Kopyalanacak XDrawData nesnesi.
     * @returns Yeni bir XDrawData nesnesi.
     */
    public static deepCopyXDrawData(data: XDrawData): XDrawData {
        return JSON.parse(JSON.stringify(data));
    }


    // Kameranin gordugu dunya dikdortgeni disindaki elementleri eleyerek render yukunu azaltir.
    // Noktalar dunya koordinatinda kalir; kamera donusumu render sirasinda uygulanir.
    public static cropXDrawData(data: XDrawData, cam: XDrawCanvasCamera, screenWidth: number, screenHeight: number, onFound?: OnFoundCallback): void {
        const worldLeft = cam.x;
        const worldTop = cam.y;
        const worldRight = cam.x + screenWidth / cam.scale;
        const worldBottom = cam.y + screenHeight / cam.scale;

        for (const layer of data.layers) {
            if (layer.visible === false || layer.opacity === 0) {
                continue; // Görünmez katmanları atla
            }
           this.cropXDrawDataElements(layer.elements, worldLeft, worldTop, worldRight, worldBottom, { layerId: layer.id, layerOpacity: layer.opacity }, onFound);
        }
    }
    // Dünyanın en mal şeysi.... ben malım. bu sefer hesaplamaktan çok cachelemek performansı düşürdü aw
    // public static readonly pointCropPathMap: Map<string, boolean> = new Map();

    public static cropXDrawDataElements(elements: XDrawElement[], left: number, top: number, right: number, bottom: number, initialFoundElement: Partial<XDrawElementCropData>, onFound?: OnFoundCallback): void {
        const cropCondition = (point: { x: number; y: number }) => {
            // kasım kasım kasılıyor 😭😭😭😭😭 o yüzden hesaplasın tekrar tekrar bane 
            // const cropArgs = `${point.x}|${point.y}|${left}|${top}|${right}|${bottom}`;
            // if (this.pointCropPathMap.has(cropArgs)) {
            //     return this.pointCropPathMap.get(cropArgs)!;
            // }
            // 
            const status = point.x >= left && point.x <= right &&
                point.y >= top && point.y <= bottom;
            // this.pointCropPathMap.set(cropArgs, status);
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
                if ((startIndex === -1 && endIndex === -1) || (startIndex > endIndex)) {
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

    public static removePointsAt(elements: XDrawElement[], x: number, y: number, radius: number): XDrawElement[] {
        return elements.map(element => {
            if (element.type === "draw") {
                const drawElement = element as XDrawDrawElement; // Tip güvenliği için uygun bir tip tanımlayın
                const filteredPoints = drawElement.points.filter(point => {
                    const dx = point.x - x;
                    const dy = point.y - y;
                    return (dx * dx + dy * dy) > (radius * radius);
                });
                return { ...drawElement, points: filteredPoints };
            }
            return element;
        }).filter(element => {
            if (element.type === "draw") {
                const drawElement = element as XDrawDrawElement; // Tip güvenliği için uygun bir tip tanımlayın
                return drawElement.points.length > 0;
            }
            if (element.type === "fill") {
                // Silgi bir dolguya degdiyse tum dolgu elementi silinir (v1: delik acma yok).
                const fillElement = element as XDrawFillElement;
                const touchesEraser = fillElement.rings.some((ring) => ring.some((point) => {
                    const dx = point.x - x;
                    const dy = point.y - y;
                    return (dx * dx + dy * dy) <= (radius * radius);
                }));
                return !touchesEraser;
            }
            return true;
        });
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
}