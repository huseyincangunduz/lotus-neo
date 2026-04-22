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
        primary:
          "bg-(--color-primary) text-(--color-surface-1) hover:bg-(--color-primary-bg-hover) hover:text-(--color-surface-1)",
        secondary: "bg-gray-500 text-white hover:bg-gray-600",
        tertiary:
          "bg-(--color-primary-bg-hover) text-(--color-fg) hover:bg-(--color-primary-bg-hover)",
      }[variant as "primary" | "secondary" | "tertiary"];

      const visualClass = {
        filled: "",
        outline: "border border-(--color-border) bg-transparent",
        ghost: "",
      }[visual as "filled" | "outline" | "ghost"];

      return `px-4 py-2 rounded-sm ${variantClass} ${visualClass}`;
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
