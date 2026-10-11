import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const server = await createServer({
    root,
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: "custom",
});
after(() => server.close());
const load = (path) => server.ssrLoadModule(`/libs/xdraw/core/src/${path}.ts`);
const geometry = await load("utils/xdraw-shape-utils");
const { XdrawDataUtils } = await load("utils/xdraw-data-utils");
const { DataDeltaUtils } = await load("utils/data-delta-utils");
const codec = await load("utils/xdraw-binary-codec");
const { CanvasDrawTools } = await load("interaction/canvas-draw-tools");
const { CanvasElementPainter } = await load("rendering/canvas-element-painter");
const { ContentBufferRenderer } = await load("rendering/content-buffer-renderer");
const { FillMaskRenderer } = await load("rendering/fill-mask-renderer");

const shape = (overrides = {}) => ({
    id: "shape", type: "shape", shape: "rectangle",
    x: 10, y: 20, width: 100, height: 80, strokeWidth: 4, color: "#112233",
    ...overrides,
});
const layer = (elements = [], overrides = {}) => ({ id: "layer", type: "layer", elements, ...overrides });

test("drag bounds normalize all four directions and negative world coordinates", () => {
    for (const [start, end] of [
        [{ x: -10, y: -20 }, { x: 100, y: 80 }],
        [{ x: 100, y: 80 }, { x: -10, y: -20 }],
        [{ x: -10, y: 80 }, { x: 100, y: -20 }],
        [{ x: 100, y: -20 }, { x: -10, y: 80 }],
    ]) {
        assert.deepEqual(geometry.shapeBoundsFromPoints(start, end), { x: -10, y: -20, width: 110, height: 100 });
    }
});

test("crop includes surrounding shapes and stroke-only intersections", () => {
    const elements = [shape({ x: -100, y: -100, width: 1000, height: 1000 }), shape({ id: "edge", x: 101 })];
    const found = [];
    XdrawDataUtils.cropXDrawData({ layers: [layer(elements)] }, { x: 0, y: 0, scale: 1 }, 100, 100, value => found.push(value));
    assert.deepEqual(found.map(value => value.elementId), ["shape", "edge"]);
    assert.equal(found[0].layerOpacity, 1);
    assert.equal(found[0].element, elements[0]);
    const hidden = [];
    XdrawDataUtils.cropXDrawData({ layers: [layer(elements, { visible: false }), layer(elements, { opacity: 0 })] },
        { x: 0, y: 0, scale: 1 }, 100, 100, value => hidden.push(value));
    assert.equal(hidden.length, 0);
});

test("selection respects ellipse geometry rather than its bounding rectangle", () => {
    const ellipse = shape({ shape: "ellipse" });
    assert.equal(geometry.shapeContainsPoint(ellipse, 60, 60), true);
    assert.equal(geometry.shapeContainsPoint(ellipse, 10, 20), false);
    assert.equal(geometry.shapeContainsPoint(shape({ width: 0 }), 10, 20), false);
});

test("eraser removes shape and label together, emits removal, and preserves other elements", () => {
    const element = shape({ label: { text: "label", color: "#000000", fontSize: 16, fontFamily: "sans-serif" } });
    const unknown = { id: "unknown", type: "future" };
    const untouched = XdrawDataUtils.removePointsAt([element, unknown], 500, 500, 5);
    assert.equal(untouched.hasChanges, false);
    assert.deepEqual(untouched.elements, [element, unknown]);
    const erased = XdrawDataUtils.removePointsAt([element, unknown], 10, 60, 5);
    assert.equal(erased.hasChanges, true);
    assert.deepEqual(erased.elements, [unknown]);
    assert.deepEqual(erased.removedPoints, [{ operation: "remove-element", elementId: "shape", type: "shape" }]);
});

test("eraser targets outline or filled interior, not an unfilled interior", () => {
    for (const kind of ["rectangle", "ellipse"]) {
        const element = shape({ shape: kind });
        assert.equal(geometry.shapeTouchesCircle(element, 60, 60, 5), false);
        assert.equal(geometry.shapeTouchesCircle(element, 8, 60, 1), true);
        assert.equal(geometry.shapeTouchesCircle(element, 5, 60, 1), false);
        assert.equal(geometry.shapeTouchesCircle({ ...element, fillColor: "#ff0000" }, 60, 60, 5), true);
    }
    assert.equal(geometry.shapeTouchesCircle(shape(), 7, 17, 2), false);
    assert.equal(geometry.shapeTouchesCircle(shape(), 7, 17, 3), true);
});

test("delta insertion reaches only the target empty layer even without visible flag", () => {
    const data = { layers: [layer(), layer([], { id: "other" })] };
    const element = shape();
    const delta = { operation: "upsert-element", layerId: "layer", elementId: element.id, type: "shape", upsertData: element };
    DataDeltaUtils.applyDataDeltas(data, [delta, delta]);
    assert.deepEqual(data.layers.map(value => value.elements.length), [1, 0]);
    DataDeltaUtils.applyDataDeltas(data, [{ operation: "remove-element", elementId: element.id }]);
    assert.equal(data.layers[0].elements.length, 0);
});

test("codec round-trip preserves labels and isolates history from subsequent mutations", () => {
    const element = shape({ label: { text: "before", color: "#000000", fontSize: 16, fontFamily: "sans-serif" } });
    const data = { layers: [layer([element])] };
    const snapshot = codec.encodeXDrawDataToBuffer(data);
    element.label.text = "after";
    const restored = codec.decodeXDrawDataFromBuffer(snapshot.skeleton, snapshot.buffer);
    assert.equal(restored.layers[0].elements[0].label.text, "before");
    restored.layers[0].elements[0].label.text = "another";
    assert.equal(codec.decodeXDrawDataFromBuffer(snapshot.skeleton, snapshot.buffer).layers[0].elements[0].label.text, "before");
    assert.deepEqual(JSON.parse(XdrawDataUtils.serializeXDrawData(data)), data);
});

function toolHost(scale = 2) {
    const setting = value => ({ get: () => value });
    const elements = [];
    const operations = [];
    let preview = null;
    const host = {
        settings: {
            mode: setting("draw"), drawType: setting("rectangle"), stylusModeEnabled: setting(false),
            strokeColor: setting("#112233"), strokeAlpha: setting(1), baseStrokeWidth: setting(6),
        },
        svgHolder: {
            finishPendingStroke() {},
            setInteractionMode() {},
            setShapePreview(value) { preview = value; },
            insertShape(value) { elements.push(structuredClone(value)); },
        },
        zoomFactor: setting(scale),
        clickedCameraX: { set() {} }, clickedCameraY: { set() {} },
        getCanvasPointInViewBox: (x, y) => ({ x: -50 + x / scale, y: 30 + y / scale }),
        captureHistorySnapshot: () => structuredClone(elements),
        pushHistorySnapshotOperation: (before, after) => operations.push({ before, after }),
    };
    return { host, elements, operations, getPreview: () => preview };
}

test("fast drag uses pointer-up coordinates, zoom, camera, and one history operation", () => {
    const fixture = toolHost();
    const tools = new CanvasDrawTools(fixture.host);
    tools.startInteraction(20, 40, "mouse", 6);
    assert.equal(fixture.elements.length, 0);
    tools.finishInteraction("mouse", { x: 220, y: 200 });
    assert.equal(fixture.getPreview(), null);
    assert.equal(fixture.operations.length, 1);
    assert.deepEqual(fixture.operations[0].before, []);
    assert.deepEqual(fixture.elements[0], shape({
        id: fixture.elements[0].id, x: -40, y: 50, width: 100, height: 80, strokeWidth: 3, color: "rgba(17, 34, 51, 1)",
    }));
});

test("preview updates without committing; cancellation and pinch discard it", () => {
    const fixture = toolHost();
    const tools = new CanvasDrawTools(fixture.host);
    tools.startInteraction(20, 40, "mouse", 6);
    tools.handleToolMove({ pointerType: "mouse" }, 220, 200);
    assert.equal(fixture.getPreview().width, 100);
    assert.equal(fixture.elements.length, 0);
    tools.finishInteraction("mouse", { x: 220, y: 200 }, true);
    assert.equal(fixture.elements.length, 0);
    tools.startInteraction(20, 40, "touch", 6);
    tools.cancelShapeInteraction();
    tools.finishInteraction("touch", { x: 220, y: 200 });
    assert.equal(fixture.elements.length, 0);
});

test("minimum size is exactly three screen pixels per dimension at every zoom", () => {
    for (const scale of [0.05, 1, 2, 40]) {
        const fixture = toolHost(scale);
        const tools = new CanvasDrawTools(fixture.host);
        tools.startInteraction(0, 0, "mouse", 6);
        tools.finishInteraction("mouse", { x: 2.9, y: 30 });
        assert.equal(fixture.elements.length, 0);
        tools.startInteraction(0, 0, "mouse", 6);
        tools.finishInteraction("mouse", { x: 3, y: 3 });
        assert.equal(fixture.elements.length, 1);
    }
});

class TestPath {
    rect() {}
    ellipse() {}
}
globalThis.Path2D = TestPath;
function context() {
    const calls = [];
    return {
        calls,
        save() { calls.push(["save"]); }, restore() { calls.push(["restore"]); },
        clip() { calls.push(["clip"]); }, beginPath() {}, rect() {}, setTransform() {}, clearRect() {},
        stroke() { calls.push(["stroke"]); }, fill() { calls.push(["fill"]); },
        measureText(text) { return { width: text.length * 8 }; },
        fillText(text, x, y) { calls.push(["text", text, x, y]); },
        getImageData() { return { data: new Uint8ClampedArray(400), width: 10, height: 10 }; },
    };
}

test("painter wraps and centers text, clips interior, and skips text in fill masks", () => {
    const painter = new CanvasElementPainter();
    const element = shape({ label: { text: "abcdefghijklmnopqrstuv", color: "#000000", fontSize: 16, fontFamily: "sans-serif" } });
    const ctx = context();
    painter.drawShapeElement(ctx, element);
    const lines = ctx.calls.filter(call => call[0] === "text");
    assert.ok(lines.length > 1);
    assert.ok(lines.every(call => call[2] === 60 && call[1].length * 8 <= 92));
    assert.equal(ctx.calls.filter(call => call[0] === "clip").length, 2);
    assert.equal(ctx.calls.at(-1)[0], "restore");
    const words = context();
    painter.drawShapeElement(words, { ...element, width: 70, label: { ...element.label, text: "hello world" } });
    assert.deepEqual(words.calls.filter(call => call[0] === "text").map(call => call[1]), ["hello", "world"]);
    const mask = context();
    painter.drawShapeElement(mask, element, false, "#000000", 8);
    assert.equal(mask.calls.some(call => call[0] === "text"), false);
    assert.equal(mask.lineWidth, 8);
});

test("content buffer and fill mask both paint shapes through the shared painter", () => {
    const painter = new CanvasElementPainter();
    const element = shape();
    const data = { layers: [layer([element])] };
    const ctx = context();
    const canvas = { width: 0, height: 0, getContext: () => ctx };
    const renderer = new ContentBufferRenderer(painter, () => canvas, {
        marginRatio: 0, maxPixels: 1000000, scaleMinRatio: 0.85, scaleMaxRatio: 1.18,
    });
    renderer.rebuild(data, { x: 0, y: 0, scale: 1 }, 200, 200);
    assert.equal(ctx.calls.filter(call => call[0] === "stroke").length, 1);
    const mask = new FillMaskRenderer(painter, () => canvas);
    mask.create(data.layers[0], { x: 0, y: 0, scale: 1 }, 200, 200);
    assert.equal(ctx.calls.filter(call => call[0] === "stroke").length, 2);
});
