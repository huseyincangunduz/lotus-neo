import type { XDrawData, XDrawDrawElement } from "../model/xdraw-data";
import type { ContentBufferDelta } from "./content-buffer-backend";

export function applyContentBufferDeltas(
    data: XDrawData,
    deltas: ContentBufferDelta[],
): void {
    for (const activeLayer of data.layers) {
        for (const delta of deltas) {
            if (delta.operation === "set-layer-opacity" && delta.layerId && typeof delta.layerOpacity === "number") {
                if (activeLayer.id === delta.layerId) {
                    activeLayer.opacity = delta.layerOpacity;
                }
                continue;
            }
            if (activeLayer.elements.length === 0 || !activeLayer.visible) {
                continue;
            }
            if (delta.operation === "upsert-element" && delta.upsertData) {
                const index = activeLayer.elements.findIndex((element) => element.id === delta.elementId);
                if (index !== -1) {
                    activeLayer.elements[index] = delta.upsertData;
                } else {
                    activeLayer.elements.push(delta.upsertData);
                }
            }

            const existingElement = activeLayer.elements.find((element) => element.id === delta.elementId);
            if (delta.operation === "remove-element") {
                activeLayer.elements = activeLayer.elements.filter((element) => element.id !== delta.elementId);
            } else if (delta.operation === "insert-points" && delta.points) {
                if (existingElement?.type === "draw") {
                    (existingElement as XDrawDrawElement).points.push(...delta.points);
                }
            } else if (delta.operation === "remove-points" && delta.points) {
                if (existingElement?.type === "draw") {
                    const drawElement = existingElement as XDrawDrawElement;
                    drawElement.points = drawElement.points.filter(
                        (point) => !delta.points!.some((deltaPoint) => deltaPoint.x === point.x && deltaPoint.y === point.y),
                    );
                }
            }
        }
    }
}