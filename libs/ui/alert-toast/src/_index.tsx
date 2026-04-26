import {
  NeolitComponent,
  state,
  type NeolitNode,
} from "@ubs-platform/neolit/core";
import { fromState } from "@ubs-platform/neolit/structural";
import { Button } from "@libs/ui/button";
import { materialSymbolsOutlined, type IconProperties, IconComponent, Icon } from "@libs/ui/icon";

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
  duration?: number | null;
}

// ─── Toast Servisi (singleton) ────────────────────────────────────────────────

class ToastService {
  toasts = state<ToastItem[]>([]);

  /** Toast ekler, id döner */
  show(item: Omit<ToastItem, "id">): string {
    const id = crypto.randomUUID();
    const toast: ToastItem = { ...item, id };
    // if (toast.duration === undefined) {
    //   toast.duration = 3500;
    // }
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
  iconProperties: IconProperties;
} {
  switch (type) {
    case "success":
      return {
        iconProperties: materialSymbolsOutlined("check_circle"),
        containerClass: "border-green-500 bg-green-100 text-green-800",
      }
    case "error":
      return {
        iconProperties: materialSymbolsOutlined("error"),
        containerClass: "border-red-500 bg-red-100 text-red-800",
      }
    case "warning":
      return {
        iconProperties: materialSymbolsOutlined("warning"),
        containerClass: "border-yellow-500 bg-yellow-100 text-yellow-800",
      }
    case "info":
    default:
      return {
        iconProperties: materialSymbolsOutlined("info"),
        containerClass: "border-blue-500 bg-blue-100 text-blue-800",
      }
  }
}

// ─── Tek bir Toast öğesi ──────────────────────────────────────────────────────

class SingleToast extends NeolitComponent<{ toast: ToastItem }> {
  properties = {
    toast: null as unknown as ToastItem,
  };

  render(): NeolitNode | NeolitNode[] {
    const { toast } = this.properties;
    const resolvedToastIconStyles = resolveToastStyle(toast.type);

    return (
      <div
        className={
          `neolit-toast flex items-start gap-3 px-4 py-3 rounded-sm shadow-lg` +
          `backdrop-blur-sm text-sm font-medium leading-snug max-w-sm w-min-300px ${resolvedToastIconStyles.containerClass}`
        }
        role="alert"
      >
        <Icon {...resolvedToastIconStyles.iconProperties} />

        <span style={{ flex: "1" }}>{toast.message}</span>

        {/* Manuel kapat */}
        <Button
          variant="ghost"
          icon={materialSymbolsOutlined("close")}
          onClick={() => toastService.dismiss(toast.id)}
          aria-label="Kapat"
        >
          
        </Button>
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
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {fromState(toastService.toasts)
          .keyFn((a) => a.id)
          .renderFor((toast) => {
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
