import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";
import { Icon, type IconProperties } from "@libs/ui/icon";

export interface FeatureItem {
  icon: IconProperties;
  itemHead: string;
  itemDesc: string;
}

export interface FeaturesGridProperties {
  id?: string;
  heading?: string;
  items?: FeatureItem[];
}

export class IntroFeaturesGrid extends NeolitComponent<FeaturesGridProperties> {
  properties: FeaturesGridProperties = {
    heading: 'Özellikler',
    items: [],
  };

  render(): NeolitNode {
    const { id, heading, items } = this.properties;

    return (
      <section id={id} className="w-full py-20 px-6 overflow-x-clip bg-(--color-surface)">
        <div className="mx-auto max-w-7xl flex flex-col gap-12">

          {heading ? (
            <h2 className="text-3xl font-black text-(--color-fg) text-center">{heading}</h2>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {(items ?? []).map((item) => (
              <article className="rounded-(--radius-md) border border-(--color-border) bg-(--color-surface-1) p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-3">
                <div className="w-10 h-10 rounded-(--radius-sm) bg-(--color-surface-2) flex items-center justify-center text-(--color-fg)">
                  <Icon {...item.icon} />
                </div>
                <h3 className="text-lg font-bold text-(--color-fg)">{item.itemHead}</h3>
                <p className="text-sm text-(--color-fg)/70 leading-relaxed">{item.itemDesc}</p>
              </article>
            ))}
          </div>

        </div>
      </section>
    );
  }
}
