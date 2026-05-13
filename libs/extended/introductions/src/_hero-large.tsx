import { NeolitComponent, state, type NeolitNode, type StateOrPlain } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";
import type { BackgroundViewProperties } from "./common";

export interface ActionItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface HeroLargeProperties extends BackgroundViewProperties {
  id?: string;
  header?: StateOrPlain<string>;
  text?: StateOrPlain<string>;
  primaryAction?: ActionItem;
  secondaryAction?: ActionItem;
  gradient?: StateOrPlain<string>;
}

export class IntroHeroLarge extends NeolitComponent<HeroLargeProperties> {
  properties: HeroLargeProperties = {
    header: state("Başlık"),
    text: state("Açıklama metni."),
    gradient: state(""),
  };

  render(): NeolitNode {
    const { id, header, text, primaryAction, secondaryAction, gradient } =
      this.properties;

    return (
      <section
        id={id}
        className={`relative w-full py-28 px-6 ${gradient ? `bg-gradient-to-br ${gradient}` : "bg-(--color-surface)"}`}
        styles={this.properties.backgroundStyles}
        
      >
        <div className="mx-auto max-w-4xl text-center flex flex-col items-center gap-10">
          <div className="flex flex-col gap-5 z-2">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-(--color-fg) leading-tight">
              {header}
            </h1>
            <p className="text-lg sm:text-xl text-(--color-fg)/70 max-w-2xl mx-auto leading-relaxed">
              {text}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center z-1">
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

            
          {
            this.properties.backgroundNode && (
              <div className="absolute w-full h-full overflow-hidden inset-0 z-0">
                {this.properties.backgroundNode}
              </div>
            )
          }
        </div>
      </section>
    );
  }
}
