export type PinchDirection = 1 | -1;

export interface ListenKeyOptions {
    event: KeyboardEvent;
    scale: number;
    canvasCenterX: number;
    canvasCenterY: number;
    onPan: (deltaX: number, deltaY: number) => void;
    onZoom: (zoom: number, centerX: number, centerY: number) => void;
    onResetZoom: () => void;
}

export interface ListenPinchOptions {
    direction: PinchDirection;
    currentDistance: number;
    lastDistance: number;
    centerX: number;
    centerY: number;
    onZoom: (zoom: number, centerX: number, centerY: number) => void;
}

export function listenPinch(options: ListenPinchOptions): number | null {
    const { currentDistance, lastDistance, direction, centerX, centerY, onZoom } = options;

    if (lastDistance <= 0 || currentDistance <= 0) {
        return null;
    }

    const pinchRatio = currentDistance / lastDistance;
    const zoom = direction === 1 ? pinchRatio : 1 / pinchRatio;
    onZoom(zoom, centerX, centerY);
    return zoom;
}

export function listenKey(options: ListenKeyOptions): boolean {
        const { event, scale, canvasCenterX, canvasCenterY, onPan, onZoom, onResetZoom } = options;
        // 20 ekran pikseli kadar dunya biriminde kaydir.
        const panStep = 20 / (scale || 1);
        const zoomIntensity = 0.1;

        switch (event.key) {
            case "ArrowLeft":
                event.preventDefault();
                onPan(panStep, 0);
                return true;

            case "ArrowRight":
                event.preventDefault();
                onPan(-panStep, 0);
                return true;

            case "ArrowUp":
                event.preventDefault();
                onPan(0, panStep);
                return true;

            case "ArrowDown":
                event.preventDefault();
                onPan(0, -panStep);
                return true;

            case "+":
            case "=":
                event.preventDefault();
                onZoom(1 + zoomIntensity, canvasCenterX, canvasCenterY);
                return true;

            case "-":
                event.preventDefault();
                onZoom(1 - zoomIntensity, canvasCenterX, canvasCenterY);
                return true;

            case "0":
                event.preventDefault();
                onResetZoom();
                return true;

            default:
                return false;
        }
}