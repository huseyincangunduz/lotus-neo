# XDraw Content Buffer Architecture

This document describes how XDraw renders finalized content in a Web Worker while keeping active strokes responsive on the main thread.

## Components

```mermaid
flowchart LR
    Input[Pointer and gesture input]
    Holder[XDrawDataHolder]
    Rasterizer[ProjectDataRasterizer]
    Canvas[Visible HTMLCanvasElement]
    FillMask[FillMaskRenderer]

    Backend{FallbackContentBufferBackend}
    WorkerBackend[WorkerContentBufferBackend]
    LocalBackend[LocalContentBufferBackend]

    Worker[content-buffer.worker]
    WorkerRenderer[ContentBufferRenderer]
    WorkerCanvas[OffscreenCanvas]
    Bitmap[ImageBitmap]

    LocalRenderer[ContentBufferRenderer]
    LocalCanvas[OffscreenCanvas or HTMLCanvasElement]
    Painter[CanvasElementPainter]

    Input --> Holder
    Holder -->|active stroke reference| Rasterizer
    Holder -->|finalized data snapshot| Rasterizer
    Holder -->|camera and viewport| Rasterizer

    Rasterizer -->|snapshot, viewport, render request| Backend
    Backend -->|primary| WorkerBackend
    Backend -.->|on unsupported API or worker failure| LocalBackend

    WorkerBackend -->|postMessage| Worker
    Worker --> WorkerRenderer
    WorkerRenderer --> Painter
    WorkerRenderer --> WorkerCanvas
    WorkerCanvas -->|createImageBitmap| Bitmap
    Bitmap -->|transferable buffer-ready message| WorkerBackend

    LocalBackend --> LocalRenderer
    LocalRenderer --> Painter
    LocalRenderer --> LocalCanvas

    WorkerBackend -->|current frame| Backend
    LocalBackend -->|current frame| Backend
    Backend -->|finalized content frame| Rasterizer
    Rasterizer -->|compose frame, active stroke, cursor, background| Canvas

    Rasterizer -->|synchronous active-layer request| FillMask
    FillMask --> Painter
```

`CanvasElementPainter` is shared by worker rendering, local rendering, export, and fill-mask generation. Flood-fill masking remains synchronous on the main thread.

## Active Stroke Flow

```mermaid
sequenceDiagram
    participant Input as Pointer input
    participant Holder as XDrawDataHolder
    participant Rasterizer as ProjectDataRasterizer
    participant Worker as Content buffer backend
    participant Canvas as Visible canvas

    Input->>Holder: beginStroke()
    Holder->>Rasterizer: setActiveDrawElement(finalized = false)

    loop Each pointer point
        Input->>Holder: insertPoint(x, y)
        Holder->>Rasterizer: requestRender()
        Rasterizer->>Canvas: draw cached content frame and active stroke
    end

    Input->>Holder: stopStroke()
    Holder->>Holder: finalized = true
    Holder->>Rasterizer: clear active stroke and invalidate buffer
    Holder->>Rasterizer: setProjectData(snapshot)
    Rasterizer->>Worker: setSnapshot and requestBuffer
    Worker-->>Rasterizer: buffer-ready frame
    Rasterizer->>Canvas: draw updated finalized content
```

Active points do not trigger `setSnapshot`. This avoids structured-cloning the growing stroke and the complete project for every pointer event. A snapshot is sent when the stroke is finalized or when a maximum-size stroke chunk is finalized.

## Consistency And Fallback

- `dataRevision` identifies the project snapshot.
- `renderRevision` identifies the camera and viewport state.
- Frames with stale revisions are discarded and their `ImageBitmap` is closed.
- The current frame stays visible while a newer asynchronous frame is being built.
- Worker startup and runtime failures permanently switch the backend instance to local rendering.
- Snapshots, viewport updates, and invalidations are mirrored to the local backend so fallback can continue immediately.
- Worker use requires `Worker`, `OffscreenCanvas`, `createImageBitmap`, and `Path2D` support.

## Message Direction

| Direction | Messages |
| --- | --- |
| Main thread to worker | `initialize`, `set-snapshot`, `set-viewport`, `invalidate`, `render` |
| Worker to main thread | `initialized`, `buffer-ready`, `error` |

The current protocol sends full snapshots at commit boundaries. Element-level upsert/delete messages can be added later if profiling shows that finalized snapshot transfer is still significant.