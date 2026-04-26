import {
  NeolitComponent,
  state,
  type NeolitNode,
} from "@ubs-platform/neolit/core";
import { fromState } from "@ubs-platform/neolit/structural";

// ─── Tipler ──────────────────────────────────────────────────────────────────

export type AlertToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: AlertToastType;
  message: string;
  /**
   * Otomatik kapanma süresi (ms). 0 verilirse el ile kapatılana kadar açık kalır.
   * Varsayılan: 3500
   */
  duration?: number;
}

// ─── Toast Servisi (singleton) ────────────────────────────────────────────────

class ToastService {
  toasts = state<ToastItem[]>([]);

  /** Toast ekler, id döner */
  show(item: Omit<ToastItem, "id">): string {
    const id = crypto.randomUUID();
    const toast: ToastItem = { duration: 3500, ...item, id };
    this.toasts.update((prev) => [...prev, toast]);

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => this.dismiss(id), toast.duration);
    }
    return id;
  }

  success(message: string, duration?: number): string {
    return this.show({ type: "success", message, duration });
  }

  error(message: string, duration?: number): string {
    return this.show({ type: "error", message, duration });
  }

  warning(message: string, duration?: number): string {
    return this.show({ type: "warning", message, duration });
  }

  info(message: string, duration?: number): string {
    return this.show({ type: "info", message, duration });
  }

  dismiss(id: string): void {
    this.toasts.update((prev) => prev.filter((t) => t.id !== id));
  }

  dismissAll(): void {
    this.toasts.set([]);
  }
}

/**
 * Uygulama genelinde kullanılacak tekil toast servisi.
 *
 * @example
 * toastService.success("Kaydedildi!");
 * toastService.error("Bir hata oluştu.", 5000);
 */
export const toastService = new ToastService();

// ─── Yardımcı: tip bazlı stiller ─────────────────────────────────────────────

function resolveToastStyle(type: AlertToastType): {
  containerClass: string;
  iconPath: string;
} {
  switch (type) {
    case "success":
      return {
        containerClass:
          "bg-emerald-500/90 text-white border border-emerald-400/40",
        iconPath: "M5 13l4 4L19 7",
      };
    case "error":
      return {
        containerClass: "bg-red-500/90 text-white border border-red-400/40",
        iconPath: "M6 18L18 6M6 6l12 12",
      };
    case "warning":
      return {
        containerClass:
          "bg-amber-400/90 text-gray-900 border border-amber-300/40",
        iconPath:
          "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
      };
    case "info":
    default:
      return {
        containerClass: "bg-sky-500/90 text-white border border-sky-400/40",
        iconPath: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      };
  }
}

// ─── Tek bir Toast öğesi ──────────────────────────────────────────────────────

class SingleToast extends NeolitComponent<{ toast: ToastItem }> {
  properties = {
    toast: null as unknown as ToastItem,
  };

  render(): NeolitNode | NeolitNode[] {
    const { toast } = this.properties;
    const { containerClass, iconPath } = resolveToastStyle(toast.type);

    return (
      <div
        className={
          `neolit-toast flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg ` +
          `backdrop-blur-sm text-sm font-medium leading-snug max-w-sm w-full ${containerClass}`
        }
        role="alert"
      >
        {/* Tip ikonu */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          style={{
            width: "20px",
            height: "20px",
            flexShrink: "0",
            marginTop: "1px",
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>

        {/* Mesaj */}
        <span style={{ flex: "1" }}>{toast.message}</span>

        {/* Manuel kapat */}
        <button
          style={{
            lineHeight: "1",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "inherit",
            padding: "0",
            opacity: "0.75",
          }}
          className="hover:opacity-100 transition-opacity focus:outline-none ml-1"
          onClick={() => toastService.dismiss(toast.id)}
          aria-label="Kapat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            style={{ width: "16px", height: "16px" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    );
  }
}

// ─── Toast Container ──────────────────────────────────────────────────────────

/**
 * Uygulamanın kök componentine bir kez eklenmelidir.
 * Toast'ları sağ-alt köşeye sabitlenmiş şekilde gösterir.
 *
 * @example
 * // app.tsx render metodunda:
 * return (
 *   <>
 *     ...
 *     <AlertToastContainer />
 *   </>
 * );
 */
export class AlertToastContainer extends NeolitComponent {
  onInit(): void {
    // this.watchToRerender(toastService.toasts);
  }

  render(): NeolitNode | NeolitNode[] {
    return (
      <div
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {fromState(toastService.toasts)
          .keyFn((a) => a.id)
          .renderFor((toast) => {
            // const wrapper = document.createElement("div");
            // wrapper.style.pointerEvents = "auto";
            // const single = new SingleToast({ toast });
            // single.assignProperties();
            // single.onInit?.();
            // single.mount(wrapper);
            // return wrapper;
            return (
              <>
                <SingleToast toast={toast} />
              </>
            );
          })}
      </div>
    );
  }
}

/*
 * ─── Animasyon CSS ────────────────────────────────────────────────────────────
 * Aşağıdaki keyframe'i global CSS dosyana ekle (örn. index.css):
 *
 * @keyframes toast-in {
 *   from { opacity: 0; transform: translateY(8px) scale(0.97); }
 *   to   { opacity: 1; transform: translateY(0)   scale(1);    }
 * }
 *
 * .neolit-toast {
 *   animation: toast-in 0.22s ease-out forwards;
 * }
 */
