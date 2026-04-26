import { IconComponent, type IconProperties } from "@libs/ui/icon";
import { fromState } from "@ubs-platform/neolit/structural";
import {
  computed,
  NeolitComponent,
  state,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";
export type ButtonVariant =
  | "filled-primary"
  | "filled-secondary"
  | "filled-tertiary"
  | "outline-primary"
  | "ghost"
  | "ghost-no-hover";

export interface ButtonProps {
  label?: StateOrPlain<string>;
  onClick?: () => void;
  // tailwind'in varsayılan renk paletini baz alarak primary, secondary ve tertiary olmak üzere üç farklı buton varyantı tanımladım. İleride ihtiyaç duyulursa bu varyantlara yeni stiller eklenebilir veya mevcut stiller güncellenebilir.
  variant?: StateOrPlain<ButtonVariant>;
  icon?: StateOrPlain<IconProperties | null>;
  style?: Record<string, StateOrPlain<string>> | undefined;
}

export class Button extends NeolitComponent<ButtonProps> {
  properties = {
    label: state<string>(""),
    onClick: () => { },
    variant: state<ButtonVariant>("filled-primary"),
    icon: state<IconProperties | null>(null),
    style: {},
  };

  buttonClassName = computed(
    [this.properties.variant],
    ([variant]: ButtonVariant[]) => {
      const variantClass = {
        "filled-primary":
          "bg-(--color-primary) text-(--color-fg) hover:bg-(--color-primary-bg-hover) hover:text-(--color-surface-1)",
        "filled-secondary": "bg-gray-500 text-white hover:bg-gray-600",
        "filled-tertiary":
          "bg-(--color-primary-bg-hover) text-(--color-fg) hover:bg-(--color-primary-bg-hover)",
        "outline-primary":
          "border border-(--color-primary) text-(--color-primary-text) hover:bg-(--color-primary-bg-hover) hover:text-(--color-surface-1)",

        ghost:
          "bg-transparent text-(--color-primary-text) hover:bg-(--color-primary-bg-hover) hover:text-(--color-surface-1)",
        "ghost-no-hover": "bg-transparent text-(--color-primary-text)",
      }[`${variant}`];

      // const visualClass = {
      //   filled: "",
      //   outline: "border border-(--color-border) bg-transparent",
      //   ghost: "",
      // }[visual as "filled" | "outline" | "ghost"];

      return `p-2 rounded-sm ${variantClass}`;
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
        style={this.properties.style}
      >
        <div className="flex items-center gap-2 min-h-[1.5em]">
          {fromState(this.properties.icon).renderIf(
            (iconProps: IconProperties) => {
              return <IconComponent {...iconProps} />;
            },
          )}
          {this.properties.label}
        </div>
      </button>
    );
  }
}
