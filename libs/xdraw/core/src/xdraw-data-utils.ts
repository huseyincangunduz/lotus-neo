import type { XDrawCanvasCamera, XDrawData, XDrawDrawElement, XDrawElement, XDrawFillElement, XDrawFillMask, XDrawLayer } from "./xdraw-data";
import { XdrawFillUtils } from "./xdraw-fill-utils";

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
    public static cropXDrawData(data: XDrawData, cam: XDrawCanvasCamera, screenWidth: number, screenHeight: number): XDrawData {
        const worldLeft = cam.x;
        const worldTop = cam.y;
        const worldRight = cam.x + screenWidth / cam.scale;
        const worldBottom = cam.y + screenHeight / cam.scale;

        const croppedData: XDrawData = { layers: [] };
        for (const layer of data.layers) {
            const elements = this.cropXDrawDataElements(layer.elements, worldLeft, worldTop, worldRight, worldBottom);
            if (elements.length > 0) {
                croppedData.layers.push({ ...layer, elements });
            }
        }
        return croppedData;
    }

    public static cropXDrawDataElements(elements: XDrawElement[], left: number, top: number, right: number, bottom: number): XDrawElement[] {
        return elements.filter(element => {
            if (element.type === "fill") {
                const fillElement = element as XDrawFillElement;
                return fillElement.rings.some((ring) => ring.some((point) =>
                    point.x >= left && point.x <= right &&
                    point.y >= top && point.y <= bottom
                ));
            }
            if (element.type !== "draw") {
                return false;
            }
            const drawElement = element as XDrawDrawElement;
            return drawElement.points.some((point) =>
                point.x >= left && point.x <= right &&
                point.y >= top && point.y <= bottom
            );
        });
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
        return 'id-' + Math.random().toString(36).slice(2, 18);
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