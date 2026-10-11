import type { XDrawPoint, XDrawShapeElement } from "../model/xdraw-data";
// Shape elementlerinin sınırlarını ve etkileşimlerini hesaplayan yardımcı fonksiyonlar.

export function shapeBoundsFromPoints(start: XDrawPoint, end: XDrawPoint) {
    return {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
    };
}

export function shapeIntersectsRect(shape: XDrawShapeElement, left: number, top: number, right: number, bottom: number): boolean {
    const padding = shape.strokeWidth / 2;
    return shape.x - padding <= right && shape.x + shape.width + padding >= left &&
        shape.y - padding <= bottom && shape.y + shape.height + padding >= top;
}

export function shapeContainsPoint(shape: XDrawShapeElement, x: number, y: number): boolean {
    if (shape.width <= 0 || shape.height <= 0) return false;
    if (shape.shape === "rectangle") {
        return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;
    }
    const dx = (x - shape.x - shape.width / 2) / (shape.width / 2);
    const dy = (y - shape.y - shape.height / 2) / (shape.height / 2);
    return dx * dx + dy * dy <= 1;
}

export function shapeTouchesCircle(shape: XDrawShapeElement, x: number, y: number, radius: number): boolean {
    const tolerance = radius + shape.strokeWidth / 2;
    if (!shapeIntersectsRect(shape, x - radius, y - radius, x + radius, y + radius)) return false;
    const inside = shapeContainsPoint(shape, x, y);
    if (inside && shape.fillColor) return true;
    if (shape.shape === "rectangle") {
        const dx = Math.max(shape.x - x, 0, x - shape.x - shape.width);
        const dy = Math.max(shape.y - y, 0, y - shape.y - shape.height);
        const distance = inside
            ? Math.min(x - shape.x, shape.x + shape.width - x, y - shape.y, shape.y + shape.height - y)
            : Math.hypot(dx, dy);
        return distance <= tolerance;
    }
    const a = shape.width / 2;
    const b = shape.height / 2;
    const dx = Math.abs(x - shape.x - a);
    const dy = Math.abs(y - shape.y - b);
    const distanceSquared = (angle: number) => (a * Math.cos(angle) - dx) ** 2 + (b * Math.sin(angle) - dy) ** 2;
    let minimum = Math.min(distanceSquared(0), distanceSquared(Math.PI / 2));
    // Search separate arcs as interior points can have multiple stationary distances.
    for (let arc = 0; arc < 8; arc++) {
        let low = arc * Math.PI / 16;
        let high = (arc + 1) * Math.PI / 16;
        for (let iteration = 0; iteration < 32; iteration++) {
            const first = low + (high - low) / 3;
            const second = high - (high - low) / 3;
            if (distanceSquared(first) < distanceSquared(second)) high = second;
            else low = first;
        }
        minimum = Math.min(minimum, distanceSquared((low + high) / 2));
    }
    return minimum <= tolerance ** 2;
}
