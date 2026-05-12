import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";

export interface ActionItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface HeroLargeProperties {
  id?: string;
  header?: string;
  text?: string;
  primaryAction?: ActionItem;
  secondaryAction?: ActionItem;
  gradient?: string;
}

export class IntroHeroLarge extends NeolitComponent<HeroLargeProperties> {
  properties: HeroLargeProperties = {
    header: "Başlık",
    text: "Açıklama metni.",
    gradient: "from-cyan-50 via-white to-blue-50",
  };

  render(): NeolitNode {
    const { id, header, text, primaryAction, secondaryAction, gradient } =
      this.properties;

    return (
      <section
        id={id}
        className={`w-full bg-gradient-to-br ${gradient ?? "from-cyan-50 via-white to-blue-50"} py-28 px-6`}
      >
        <div className="mx-auto max-w-4xl text-center flex flex-col items-center gap-10">
          <div className="flex flex-col gap-5">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-slate-900 leading-tight">
              {header}
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              {text}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            {primaryAction ? (
              <Button
                onClick={() => primaryAction.onClick?.()}
                variant={"filled-primary"}
                label={primaryAction.label}
              ></Button>
            ) : // <a
            //   href={primaryAction.href ?? '#'}
            //   onclick={() => primaryAction.onClick?.()}
            //   className="inline-block rounded-xl bg-slate-900 px-7 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-slate-700 transition-colors"
            // >
            //   {primaryAction.label}
            // </a>
            null}
            {secondaryAction ? (
              <Button
                // href={secondaryAction.href ?? "#"}
                onClick={() => secondaryAction.onClick?.()}
                label={secondaryAction.label}
                variant={"filled-secondary"}
                // className="inline-block rounded-xl border-2 border-slate-300 px-7 py-3.5 text-sm font-bold text-slate-700 hover:border-slate-500 hover:bg-slate-50 transition-colors"
              >
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }
}
