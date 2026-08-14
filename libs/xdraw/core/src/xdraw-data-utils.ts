import type { XDrawCanvasCamera, XDrawData, XDrawDrawElement, XDrawElement, XDrawLayer } from "./xdraw-data";
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
            return true;
        });

        
    }

    public static generateUniqueId(): string {
        return 'id-' + Math.random().toString(36).slice(2, 18);
    }

    /**
     * Doldurulabilir boş noktaları belirler ve bir Map yapısı döndürür. Bu Map, 
     * x koordinatlarını anahtar olarak kullanır ve her x koordinatı için y koordinatlarını içeren bir alt Map içerir. 
     * Alt Map, y koordinatlarını anahtar olarak kullanır ve değer olarak true döner.
     * @param worldX 
     * @param worldY 
     * @param elements 
     * @returns 
     */
    public static allEmptyFillablePoints(worldX: number, worldY: number, elements: XDrawElement[]): Map<number, Map<number, boolean>> {
        return XdrawFillUtils.allEmptyFillablePoints(worldX, worldY, elements);
    }

    public static fillDye(activeLayer: XDrawLayer, x: number, y: number, color: string): boolean {
        return XdrawFillUtils.fillDye(activeLayer, x, y, color);
    }

    public static fillPoints(activeLayer: XDrawLayer, fillablePoints: Map<number, Map<number, boolean>>, color: string): void {
        XdrawFillUtils.fillPoints(activeLayer, fillablePoints, color);
    }


    // Bu fonksiyon, verilen XDrawElement dizisindeki tüm "draw" tipindeki elementlerin minimum ve maksimum x ve y koordinatlarını hesaplar.
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
            }
        }

        minX = Math.max(0, minX);
        minY = Math.max(0, minY);
        maxX = maxWorldX !== undefined ? Math.min(maxWorldX, maxX) : maxX;
        maxY = maxWorldY !== undefined ? Math.min(maxWorldY, maxY) : maxY;

        return { minX, minY, maxX, maxY };
    }
}