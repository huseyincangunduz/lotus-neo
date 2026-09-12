import type { ContentBufferViewport } from "./content-buffer-backend";
import type { ContentBufferInfo, ContentBufferRendererOptions } from "./content-buffer-renderer";

export function isContentBufferCurrent(
    buffer: ContentBufferInfo | undefined,
    viewport: ContentBufferViewport,
    options: ContentBufferRendererOptions,
): boolean {
    if (!buffer) {
        return false;
    }

    const { camera, width, height } = viewport;
    const scaleRatio = camera.scale / buffer.scale;
    if (scaleRatio < options.scaleMinRatio || scaleRatio > options.scaleMaxRatio) {
        return false;
    }

    const viewRight = camera.x + width / camera.scale;
    const viewBottom = camera.y + height / camera.scale;
    const bufferRight = buffer.originX + buffer.width / buffer.scale;
    const bufferBottom = buffer.originY + buffer.height / buffer.scale;
    const safetyPadX = (bufferRight - buffer.originX) * 0.05;
    const safetyPadY = (bufferBottom - buffer.originY) * 0.05;

    return (
        camera.x >= buffer.originX + safetyPadX &&
        camera.y >= buffer.originY + safetyPadY &&
        viewRight <= bufferRight - safetyPadX &&
        viewBottom <= bufferBottom - safetyPadY
    );
}
