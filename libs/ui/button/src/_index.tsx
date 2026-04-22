import { IconComponent, type IconProperties } from "@libs/ui/icon";
import { fromState } from "@ubs-platform/neolit/structural";
import {
  computed,
  NeolitComponent,
  state,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";
export interface ButtonProps {
  label: StateOrPlain<string>;
  onClick?: () => void;
  // tailwind'in varsayılan renk paletini baz alarak primary, secondary ve tertiary olmak üzere üç farklı buton varyantı tanımladım. İleride ihtiyaç duyulursa bu varyantlara yeni stiller eklenebilir veya mevcut stiller güncellenebilir.
  variant?: StateOrPlain<"primary" | "secondary" | "tertiary">;
  visual?: StateOrPlain<"filled" | "outline" | "ghost">;
  icon?: StateOrPlain<IconProperties | null>;
}

export class Button extends NeolitComponent<ButtonProps> {
  properties = {
    label: state<string>(""),
    onClick: () => {},
    variant: state<"primary" | "secondary" | "tertiary">("primary"),
    visual: state<"filled" | "outline" | "ghost">("filled"),
    icon: state<IconProperties | null>(null),
  };

  buttonClassName = computed(
    [this.properties.variant, this.properties.visual],
    ([variant, visual]) => {
      const variantClass = {
        "filled-primary":
          "bg-(--color-primary) text-(--color-fg) hover:bg-(--color-primary-bg-hover) hover:text-(--color-surface-1)",
        "filled-secondary": "bg-gray-500 text-white hover:bg-gray-600",
        "filled-tertiary":
          "bg-(--color-primary-bg-hover) text-(--color-fg) hover:bg-(--color-primary-bg-hover)",
        "outline-primary":
          "border border-(--color-primary) text-(--primary-color-text) hover:bg-(--color-primary-bg-hover) hover:text-(--color-surface-1)",
        "outline-secondary":
          "border border-gray-500 text-gray-500 hover:bg-gray-600 hover:text-white",
        "outline-tertiary":
          "border border-(--color-primary-bg-hover) text-(--color-primary-bg-hover) hover:bg-(--color-primary-bg-hover) hover:text-(--color-surface-1)",
        "ghost-primary":
          "bg-transparent text-(--color-primary) hover:bg-(--color-primary-bg-hover) hover:text-(--color-surface-1)",
        "ghost-secondary":
          "bg-transparent text-gray-500 hover:bg-gray-600 hover:text-white",
        "ghost-tertiary":
          "bg-transparent text-(--color-primary-bg-hover) hover:bg-(--color-primary-bg-hover) hover:text-(--color-surface-1)",
      }[
        `${visual}-${variant}` as
          | "filled-primary"
          | "filled-secondary"
          | "filled-tertiary"
          | "outline-primary"
          | "outline-secondary"
          | "outline-tertiary"
          | "ghost-primary"
          | "ghost-secondary"
          | "ghost-tertiary"
      ];

      // const visualClass = {
      //   filled: "",
      //   outline: "border border-(--color-border) bg-transparent",
      //   ghost: "",
      // }[visual as "filled" | "outline" | "ghost"];

      return `px-4 py-2 rounded-sm ${variantClass}`;
    },
  );
  /**
   *
   */
  // constructor({ label, onClick, variant, visual, icon }: ButtonProps) {
  //     super();
  //     this.label.set(label);
  //     this.onClick = onClick;
  //     this.variant.set(variant || "primary");
  //     this.visual.set(visual || "filled");
  //     this.icon.set(icon ?? null);
  // }
  render(): NeolitNode | NeolitNode[] | NeolitComponent | null {
    return (
      <button
        className={this.buttonClassName}
        onClick={this.properties.onClick}
      >
        <div className="flex items-center gap-2">
          {fromState(this.properties.icon).renderIf(
            (iconProps: IconProperties) => {
              return (
                <IconComponent
                  className={iconProps.className}
                  content={iconProps.content}
                  imgSrc={iconProps.imgSrc}
                />
              );
            },
          )}
          {this.properties.label}
        </div>
      </button>
    );
  }
}
