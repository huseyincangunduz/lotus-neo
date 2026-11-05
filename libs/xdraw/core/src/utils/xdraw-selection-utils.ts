import type {
    XDrawDrawElement,
    XDrawElement,
    XDrawFillElement,
    XDrawShapeElement,
    XDrawTextElement,
} from "../model/xdraw-data";
import { shapeContainsPoint, shapeTouchesCircle } from "./xdraw-shape-utils";
import { cloneObjectDeep } from "./clone-utils";

export interface XDrawElementBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function combineXDrawElementBounds(bounds: XDrawElementBounds[]): XDrawElementBounds | null {
    if (bounds.length === 0) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const bound of bounds) {
        left = Math.min(left, bound.x);
        top = Math.min(top, bound.y);
        right = Math.max(right, bound.x + bound.width);
        bottom = Math.max(bottom, bound.y + bound.height);
    }
    return { x: left, y: top, width: right - left, height: bottom - top };
}

export function cloneXDrawElementsAtPoint(
    elements: XDrawElement[],
    x: number,
    y: number,
    generateId: () => string,
): XDrawElement[] {
    const bounds = combineXDrawElementBounds(elements
        .map(getXDrawElementBounds)
        .filter((value): value is XDrawElementBounds => value !== null));
    if (!bounds) throw new Error("Cannot paste elements without geometry.");
    const copies = cloneObjectDeep(elements);
    for (const element of copies) {
        element.id = generateId();
        translateXDrawElement(element, x - bounds.x, y - bounds.y);
    }
    return copies;
}

export function xdrawElementBoundsIntersectsRect(
    bounds: XDrawElementBounds,
    rect: XDrawElementBounds,
): boolean {
    return bounds.x <= rect.x + rect.width &&
        bounds.y <= rect.y + rect.height &&
        bounds.x + bounds.width >= rect.x &&
        bounds.y + bounds.height >= rect.y;
}

function boundsFromPoints(points: Array<{ x: number; y: number }>, padding = 0): XDrawElementBounds | null {
    if (points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }
    return {
        x: minX - padding,
        y: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
    };
}

export function getXDrawElementBounds(element: XDrawElement): XDrawElementBounds | null {
    if (element.type === "draw") {
        const points = (element as XDrawDrawElement).points;
        let padding = 0;
        for (const point of points) padding = Math.max(padding, point.size / 2);
        return boundsFromPoints(points, padding);
    }

    if (element.type === "text") {
        const text = element as XDrawTextElement;
        return {
            x: text.position.x,
            y: text.position.y,
            width: text.fontSize * text.text.length,
            height: text.fontSize,
        };
    }

    if (element.type === "shape") {
        const shape = element as XDrawShapeElement;
        const padding = shape.strokeWidth / 2;
        return {
            x: shape.x - padding,
            y: shape.y - padding,
            width: shape.width + padding * 2,
            height: shape.height + padding * 2,
        };
    }

    if (element.type === "fill") {
        const rings = (element as XDrawFillElement).rings;
        return boundsFromPoints(rings.flat());
    }

    return null;
}

function distanceToSegmentSquared(
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number },
): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    const closestX = start.x + ratio * dx;
    const closestY = start.y + ratio * dy;
    return (point.x - closestX) ** 2 + (point.y - closestY) ** 2;
}

function drawElementContainsPoint(element: XDrawDrawElement, x: number, y: number, tolerance: number): boolean {
    for (let index = 0; index < element.points.length; index++) {
        const point = element.points[index];
        const radius = tolerance + point.size / 2;
        if ((point.x - x) ** 2 + (point.y - y) ** 2 <= radius ** 2) return true;

        const next = element.points[index + 1];
        if (next && !next.breakBefore) {
            const segmentRadius = tolerance + Math.max(point.size, next.size) / 2;
            if (distanceToSegmentSquared({ x, y }, point, next) <= segmentRadius ** 2) return true;
        }
    }
    return false;
}

function fillElementContainsPoint(element: XDrawFillElement, x: number, y: number, tolerance: number): boolean {
    let inside = false;
    for (const ring of element.rings) {
        let ringContainsPoint = false;
        for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index++) {
            const current = ring[index];
            const previous = ring[previousIndex];
            if (tolerance > 0 && distanceToSegmentSquared({ x, y }, current, previous) <= tolerance ** 2) {
                return true;
            }
            if (
                (current.y > y) !== (previous.y > y) &&
                x < ((previous.x - current.x) * (y - current.y)) / (previous.y - current.y) + current.x
            ) {
                ringContainsPoint = !ringContainsPoint;
            }
        }
        if (ringContainsPoint) inside = !inside;
    }
    return inside;
}

export function xdrawElementContainsPoint(
    element: XDrawElement,
    x: number,
    y: number,
    tolerance: number,
): boolean {
    if (element.type === "draw") {
        return drawElementContainsPoint(element as XDrawDrawElement, x, y, tolerance);
    }
    if (element.type === "shape") {
        const shape = element as XDrawShapeElement;
        return shapeContainsPoint(shape, x, y) || shapeTouchesCircle(shape, x, y, tolerance);
    }
    if (element.type === "text") {
        const text = element as XDrawTextElement;
        return x >= text.position.x - tolerance &&
            x <= text.position.x + text.fontSize * text.text.length + tolerance &&
            y >= text.position.y - tolerance &&
            y <= text.position.y + text.fontSize + tolerance;
    }
    if (element.type === "fill") {
        return fillElementContainsPoint(element as XDrawFillElement, x, y, tolerance);
    }
    return false;
}

export function translateXDrawElement(element: XDrawElement, deltaX: number, deltaY: number): boolean {
    if (element.type === "draw") {
        for (const point of (element as XDrawDrawElement).points) {
            point.x += deltaX;
            point.y += deltaY;
        }
        return true;
    }
    if (element.type === "shape") {
        const shape = element as XDrawShapeElement;
        shape.x += deltaX;
        shape.y += deltaY;
        return true;
    }
    if (element.type === "text") {
        const text = element as XDrawTextElement;
        text.position.x += deltaX;
        text.position.y += deltaY;
        return true;
    }
    if (element.type === "fill") {
        const fill = element as XDrawFillElement;
        for (const ring of fill.rings) {
            for (const point of ring) {
                point.x += deltaX;
                point.y += deltaY;
            }
        }
        if (fill.seed) {
            fill.seed.x += deltaX;
            fill.seed.y += deltaY;
        }
        return true;
    }
    return false;
}
