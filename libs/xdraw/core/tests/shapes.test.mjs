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
const selection = await load("utils/xdraw-selection-utils");
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

test("selection hit testing and bounds cover strokes, text, and fills", () => {
    const stroke = {
        id: "stroke", type: "draw", color: "#000000",
        points: [{ x: 10, y: 10, size: 4 }, { x: 30, y: 10, size: 8 }],
    };
    const text = {
        id: "text", type: "text", text: "hi", position: { x: 40, y: 10 },
        fontSize: 12, fontFamily: "sans-serif", color: "#000000",
    };
    const fill = {
        id: "fill", type: "fill", color: "#000000",
        rings: [[{ x: 60, y: 10 }, { x: 80, y: 10 }, { x: 80, y: 30 }, { x: 60, y: 30 }]],
    };
    assert.equal(selection.xdrawElementContainsPoint(stroke, 20, 12, 1), true);
    assert.deepEqual(selection.getXDrawElementBounds(stroke), { x: 6, y: 6, width: 28, height: 8 });
    assert.equal(selection.xdrawElementContainsPoint(text, 45, 15, 0), true);
    assert.equal(selection.xdrawElementContainsPoint(fill, 70, 20, 0), true);
    assert.equal(selection.xdrawElementContainsPoint(fill, 90, 20, 0), false);
    assert.deepEqual(selection.getXDrawElementBounds(fill), { x: 60, y: 10, width: 20, height: 20 });
});

test("moving an element translates all its geometry and stroke breaks remain intact", () => {
    const stroke = {
        id: "stroke", type: "draw", color: "#000000",
        points: [{ x: 10, y: 20, size: 4 }, { x: 30, y: 40, size: 6, breakBefore: true }],
    };
    assert.equal(selection.translateXDrawElement(stroke, -5, 3), true);
    assert.deepEqual(stroke.points, [
        { x: 5, y: 23, size: 4 },
        { x: 25, y: 43, size: 6, breakBefore: true },
    ]);
});

test("clipboard copies every geometry type to the target, preserving spacing and independent data", () => {
    const elements = [
        shape({ x: 10, y: 20, strokeWidth: 0, label: { text: "original" } }),
        { id: "stroke", type: "draw", color: "#123456", finalized: true,
            points: [{ x: 20, y: 30, size: 2, breakBefore: true }] },
        { id: "text", type: "text", text: "hello", fontSize: 16,
            fontFamily: "sans-serif", color: "#000000", position: { x: 30, y: 40 } },
        { id: "fill", type: "fill", color: "#000000", seed: { x: 50, y: 60 },
            rings: [[{ x: 40, y: 50 }, { x: 60, y: 50 }, { x: 50, y: 70 }]] },
    ];
    const original = structuredClone(elements);
    let id = 0;
    const generateId = () => `copy-${id++}`;
    const copies = selection.cloneXDrawElementsAtPoint(elements, -100, 200, generateId);
    assert.deepEqual(elements, original);
    assert.deepEqual(copies.map(element => element.id), ["copy-0", "copy-1", "copy-2", "copy-3"]);
    assert.deepEqual(selection.combineXDrawElementBounds(copies.map(selection.getXDrawElementBounds)),
        { x: -100, y: 200, width: 100, height: 80 });
    assert.deepEqual(copies[1].points, [{ x: -90, y: 210, size: 2, breakBefore: true }]);
    assert.deepEqual(copies[2].position, { x: -80, y: 220 });
    assert.deepEqual(copies[3].seed, { x: -60, y: 240 });
    assert.deepEqual(copies[3].rings[0][0], { x: -70, y: 230 });
    copies[0].label.text = "changed";
    copies[1].points[0].x = 999;
    const pastedAgain = selection.cloneXDrawElementsAtPoint(elements, -100, 200, generateId);
    assert.equal(pastedAgain[0].label.text, "original");
    assert.equal(pastedAgain[1].points[0].x, -90);
    assert.equal(pastedAgain[0].id, "copy-4");
    assert.deepEqual(elements, original);
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

test("selection tool drags the hit element and records one undo operation", () => {
    const element = { id: "shape", type: "shape", x: 10, y: 20, width: 30, height: 40 };
    const setting = value => ({ get: () => value });
    const host = {
        settings: { mode: setting("selection"), drawType: setting("pencil"), stylusModeEnabled: setting(false) },
        zoomFactor: setting(2),
        clickedCameraX: { set() {} },
        clickedCameraY: { set() {} },
        smoothedPressure: null,
        lastDrawPoint: null,
        lastErasePoint: null,
        getCanvasPointInViewBox: (x, y) => ({ x: x / 2, y: y / 2 }),
        svgHolder: {
            finishPendingStroke() {},
            setInteractionMode() {},
            findElementAtPoint: () => element,
            setSelectionMarquee() {},
            setSelectedElements(ids) { this.selected = ids; },
        },
    };
    const tools = new CanvasDrawTools(host);
    tools.startInteraction(20, 40, "mouse", 1);
    tools.finishInteraction("mouse", { x: 22, y: 42 });

    assert.deepEqual({ x: element.x, y: element.y }, { x: 10, y: 20 });
    assert.deepEqual(host.svgHolder.selected, ["shape"]);
});

test("marquee intersection includes partial overlap, enclosure, and touching edges", () => {
    const rect = { x: -10, y: -20, width: 40, height: 50 };
    for (const bounds of [
        { x: -15, y: 0, width: 10, height: 10 },
        { x: 25, y: 0, width: 10, height: 10 },
        { x: 0, y: -25, width: 10, height: 10 },
        { x: 0, y: 25, width: 10, height: 10 },
        { x: -100, y: -100, width: 200, height: 200 },
        { x: 0, y: 0, width: 5, height: 5 },
        { x: 30, y: 30, width: 5, height: 5 },
    ]) {
        assert.equal(selection.xdrawElementBoundsIntersectsRect(bounds, rect), true);
    }
    for (const bounds of [
        { x: -21, y: 0, width: 10, height: 10 },
        { x: 31, y: 0, width: 10, height: 10 },
        { x: 0, y: -31, width: 10, height: 10 },
        { x: 0, y: 31, width: 10, height: 10 },
    ]) {
        assert.equal(selection.xdrawElementBoundsIntersectsRect(bounds, rect), false);
    }
});

test("selection drag includes partial overlaps and move mode translates the selection once", () => {
    const first = { id: "first", type: "shape", x: 10, y: 10, width: 10, height: 10, strokeWidth: 0 };
    const second = { id: "second", type: "shape", x: 30, y: 30, width: 10, height: 10, strokeWidth: 0 };
    const partial = { id: "partial", type: "shape", x: 45, y: 45, width: 20, height: 20, strokeWidth: 0 };
    const outside = { id: "outside", type: "shape", x: 70, y: 70, width: 20, height: 20, strokeWidth: 0 };
    const elements = [first, second, partial, outside];
    const selected = [];
    const operations = [];
    let marquee;
    let interactionMode;
    let hitElement = first;
    const mode = { value: "selection", get() { return this.value; } };
    const host = {
        settings: { mode, drawType: { get: () => "pencil" }, stylusModeEnabled: { get: () => false } },
        zoomFactor: { get: () => 2 },
        clickedCameraX: { set() {} },
        clickedCameraY: { set() {} },
        smoothedPressure: null,
        lastDrawPoint: null,
        lastErasePoint: null,
        getCanvasPointInViewBox: (x, y) => ({ x: x / 2, y: y / 2 }),
        captureHistorySnapshot: () => elements.map(element => [element.id, element.x, element.y]),
        pushHistorySnapshotOperation: (before, after) => operations.push({ before, after }),
        restoreHistorySnapshot: async () => {},
        svgHolder: {
            finishPendingStroke() {},
            setInteractionMode(value) { interactionMode = value; },
            setSelectionMarquee(value) { marquee = value; },
            setSelectedElements(ids) { selected.splice(0, selected.length, ...ids); },
            getSelectedElementIds: () => [...selected],
            findElementsIntersectingRect(rect) {
                return elements.filter(element => selection.xdrawElementBoundsIntersectsRect(
                    selection.getXDrawElementBounds(element), rect,
                ));
            },
            findElementAtPoint: () => hitElement,
            moveElementsBy(ids, dx, dy) {
                for (const element of elements) {
                    if (ids.includes(element.id)) {
                        element.x += dx;
                        element.y += dy;
                    }
                }
                return true;
            },
        },
    };
    const tools = new CanvasDrawTools(host);
    tools.startInteraction(0, 0, "mouse", 1);
    tools.handleToolMove({ pointerType: "mouse" }, 100, 100);
    assert.deepEqual(marquee, { x: 0, y: 0, width: 50, height: 50 });
    tools.finishInteraction("mouse", { x: 100, y: 100 });
    assert.deepEqual(selected, ["first", "second", "partial"]);
    assert.equal(marquee, undefined);

    mode.value = "move";
    tools.startInteraction(20, 20, "mouse", 1);
    assert.equal(interactionMode, "move");
    tools.handleToolMove({ pointerType: "mouse" }, 40, 40);
    tools.finishInteraction("mouse", { x: 40, y: 40 });
    assert.deepEqual(elements.map(element => [element.x, element.y]), [[20, 20], [40, 40], [55, 55], [70, 70]]);
    assert.equal(operations.length, 1);

    hitElement = outside;
    tools.startInteraction(100, 100, "mouse", 1);
    tools.handleToolMove({ pointerType: "mouse" }, 120, 120);
    tools.finishInteraction("mouse", { x: 120, y: 120 });
    assert.deepEqual(elements.map(element => [element.x, element.y]), [[20, 20], [40, 40], [55, 55], [70, 70]]);
    assert.equal(operations.length, 1);
});

test("cancelling selection for a long press preserves it; clearing it prevents pointer-up reselection", () => {
    let selected = ["existing"];
    let marquee;
    const host = {
        settings: {
            mode: { get: () => "selection" },
            drawType: { get: () => "pencil" },
        },
        clickedCameraX: { set() {} },
        clickedCameraY: { set() {} },
        getCanvasPointInViewBox: (x, y) => ({ x, y }),
        svgHolder: {
            finishPendingStroke() {},
            setInteractionMode() {},
            setSelectionMarquee(value) { marquee = value; },
            setSelectedElements(ids) { selected = ids; },
        },
    };
    const tools = new CanvasDrawTools(host);
    tools.startInteraction(100, 100, "mouse", 1);
    tools.handleToolMove({ pointerType: "mouse" }, 150, 150);
    assert.ok(marquee);
    tools.cancelSelectionInteraction();
    assert.equal(marquee, undefined);
    assert.deepEqual(selected, ["existing"]);
    tools.startInteraction(100, 100, "mouse", 1);
    tools.clearSelection();
    tools.finishInteraction("mouse", { x: 150, y: 150 });
    assert.deepEqual(selected, []);
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
