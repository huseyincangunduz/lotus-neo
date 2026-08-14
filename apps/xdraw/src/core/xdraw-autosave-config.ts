export interface AutosaveViewport {
  x: number;
  y: number;
  scale: number;
}

export interface AutosavePayload<TSnapshot> {
  snapshot: TSnapshot;
  viewport: AutosaveViewport;
  savedAt: string;
}

interface AutosaveConfigParams<TSnapshot> {
  storageKey: string;
  captureSnapshot: () => TSnapshot;
  getViewport: () => AutosaveViewport;
  applyViewport: (viewport: AutosaveViewport) => void;
  applySnapshot: (snapshot: TSnapshot) => Promise<void>;
  isValidSnapshot: (snapshot: unknown) => snapshot is TSnapshot;
  syncViewportSize?: () => void;
  intervalMs?: number;
}

function isValidViewport(viewport: unknown): viewport is AutosaveViewport {
  if (!viewport || typeof viewport !== "object") {
    return false;
  }

  const candidate = viewport as Partial<AutosaveViewport>;
  return (
    Number.isFinite(candidate.x) &&
    Number.isFinite(candidate.y) &&
    Number.isFinite(candidate.scale)
  );
}

export function getAutosaveConfig<TSnapshot>(params: AutosaveConfigParams<TSnapshot>) {
  const intervalMs = params.intervalMs ?? 1200;
  let autosaveTimerId: number | null = null;
  let autosaveDirty = false;

  const write = (): void => {
    const payload: AutosavePayload<TSnapshot> = {
      snapshot: params.captureSnapshot(),
      viewport: params.getViewport(),
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(params.storageKey, JSON.stringify(payload));
      autosaveDirty = false;
    } catch (error) {
      console.error("Autosave yazilamadi:", error);
    }
  };

  return {
    markDirty(): void {
      autosaveDirty = true;
    },

    flush(): void {
      if (!autosaveDirty) {
        return;
      }
      write();
    },

    start(): void {
      if (autosaveTimerId !== null) {
        window.clearInterval(autosaveTimerId);
      }

      autosaveTimerId = window.setInterval(() => {
        if (!autosaveDirty) {
          return;
        }
        write();
      }, intervalMs);
    },

    stop(): void {
      if (autosaveTimerId === null) {
        return;
      }

      window.clearInterval(autosaveTimerId);
      autosaveTimerId = null;
    },

    tryRestore(): boolean {
      const raw = localStorage.getItem(params.storageKey);
      if (!raw) {
        return false;
      }

      try {
        const parsed = JSON.parse(raw) as Partial<AutosavePayload<unknown>>;
        if (!params.isValidSnapshot(parsed.snapshot) || !isValidViewport(parsed.viewport)) {
          return false;
        }

        void params.applySnapshot(parsed.snapshot).catch((error) => {
          console.error("Autosave geri yuklenemedi:", error);
        });

        params.syncViewportSize?.();
        params.applyViewport(parsed.viewport);
        return true;
      } catch (error) {
        console.error("Autosave parse edilemedi:", error);
        return false;
      }
    },
  };
}
