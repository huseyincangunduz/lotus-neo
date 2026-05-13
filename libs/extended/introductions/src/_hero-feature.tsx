import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";

export interface HeroFeatureActionItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface HeroFeatureProperties {
  id?: string;
  header?: string;
  text?: string;
  actions?: HeroFeatureActionItem[];
  image?: string;
  imageAlt?: string;
  imagePosition?: 'left' | 'right';
}

export class IntroHeroFeature extends NeolitComponent<HeroFeatureProperties> {
  properties: HeroFeatureProperties = {
    header: 'Başlık',
    text: 'Açıklama metni.',
    imagePosition: 'right',
  };

  render(): NeolitNode {
    const { id, header, text, actions, image, imageAlt, imagePosition } = this.properties;
    const imageRight = (imagePosition ?? 'right') === 'right';
    const actionsList = actions ?? [];

    return (
      <section id={id} className="relative w-full py-20 px-6 bg-(--color-surface)">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Text column */}
          <div className={`flex flex-col gap-6 ${imageRight ? 'lg:order-1' : 'lg:order-2'}`}>
            <h2 className="text-4xl font-black tracking-tight text-(--color-fg) leading-tight">
              {header}
            </h2>
            <p className="text-lg text-(--color-fg)/70 leading-relaxed">
              {text}
            </p>
            {actionsList.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {actionsList.map((action, i) => (
                  <a
                    href={action.href ?? '#'}
                    onclick={() => action.onClick?.()}
                    className={
                      i === 0
                        ? 'inline-block rounded-(--radius-md) bg-(--color-primary) px-6 py-3 text-sm font-bold text-(--color-primary-text-on-bg) shadow-md hover:bg-(--color-primary-hover) transition-colors'
                        : 'inline-block rounded-(--radius-md) border-2 border-(--color-border) px-6 py-3 text-sm font-bold text-(--color-fg) hover:border-(--color-primary) hover:bg-(--color-surface-1) transition-colors'
                    }
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {/* Image column */}
          {image ? (
            <div className={`flex justify-center items-center ${imageRight ? 'lg:order-2' : 'lg:order-1'}`}>
              <img
                src={image}
                alt={imageAlt ?? ''}
                className="max-w-full max-h-80 object-contain drop-shadow-xl"
              />
            </div>
          ) : null}

        </div>
      </section>
    );
  }
}
