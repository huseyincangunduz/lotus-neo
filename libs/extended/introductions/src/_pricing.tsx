import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";
export interface PricingPlan {
  name: string;
  price: string;
  features: string[];
  buttonLabel: string;
  highlight?: boolean;
  onAction?: () => void;
}

export interface PricingProperties {
  id?: string;
  heading?: string;
  plans?: PricingPlan[];
}

export class IntroPricing extends NeolitComponent<PricingProperties> {
  properties: PricingProperties = {
    heading: "Fiyatlandırma",
    plans: [],
  };

  render(): NeolitNode {
    const { id, heading, plans } = this.properties;

    return (
      <section id={id} className="w-full py-20 px-6 bg-(--color-surface)">
        <div className="mx-auto max-w-7xl flex flex-col gap-12">
          {heading ? (
            <div className="text-center flex flex-col gap-3">
              <h2 className="text-3xl font-black text-(--color-fg)">{heading}</h2>
              <p className="text-(--color-fg)/60 text-base">
                İhtiyacınıza uygun planı seçin.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {(plans ?? []).map((plan) => (
              <div
                className={
                  plan.highlight
                    ? "rounded-(--radius-md) border-2 border-(--color-border) bg-(--color-primary) p-8 shadow-2xl flex flex-col gap-6 scale-[1.03]"
                    : "rounded-(--radius-md) border border-(--color-border) bg-(--color-surface-1) p-8 shadow-sm flex flex-col gap-6"
                }
              >
                {/* Plan name + price */}
                <div className="flex flex-col gap-1">
                  <h3
                    className={`text-sm font-bold uppercase tracking-widest ${plan.highlight ? "text-(--color-primary-text-on-bg)" : "text-(--color-fg)/60"}`}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className={`text-4xl font-black tracking-tight ${plan.highlight ? "text-(--color-primary-fg-active)" : "text-(--color-primary-fg-active)"}`}
                  >
                    {plan.price}
                  </p>
                </div>

                {/* Feature list */}
                <ul className="flex flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li
                      className={`flex items-center gap-2 text-sm ${plan.highlight ? "text-(--color-primary-text-on-bg)" : "text-(--color-fg)/70"}`}
                    >
                      <i
                        class="material-symbols-outlined"
                        style={{
                          fontSize: "1rem",
                          lineHeight: "1rem",
                          color: "var(--color-primary-card-bg-text)",
                        }}
                      >
                        check_circle
                      </i>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                <Button
                  onClick={() => plan.onAction?.()}
                  variant={"filled-primary"}
                  label={plan.buttonLabel}
                ></Button>
                {/* <button
                  onclick={() => plan.onAction?.()}
                  className={
                    plan.highlight
                      ? 'w-full rounded-xl bg-white py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 transition-colors mt-auto'
                      : 'w-full rounded-xl border-2 border-slate-900 py-3 text-sm font-bold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors mt-auto'
                  }
                >
                  {plan.buttonLabel}
                </button> */}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
}
