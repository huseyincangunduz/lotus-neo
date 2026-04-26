import {
  computed,
  getStateValue,
  NeolitComponent,
  state,
  State,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";
import { IconComponent, materialSymbolsOutlined } from "@libs/ui/icon";

export interface CheckboxProps {
  /** Checkbox'ın işaretli olup olmadığı */
  checked?: StateOrPlain<boolean>;
  /** Etiket metni */
  label?: StateOrPlain<string>;
  /** Checkbox devre dışı mı? */
  disabled?: StateOrPlain<boolean>;
  /** Durum değiştiğinde çağrılır */
  onChange?: (checked: boolean) => void;
}

export class Checkbox extends NeolitComponent<CheckboxProps> {
  properties = {
    checked: state<boolean>(false),
    label: state<string>(""),
    disabled: state<boolean>(false),
    onChange: (_v: boolean) => {},
  };

  boxClass = computed(
    [this.properties.checked, this.properties.disabled],
    ([checked, disabled]: [boolean, boolean]) => {
      const base =
        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 " +
        "transition-colors duration-150 ";
      if (disabled) {
        return (
          base +
          "opacity-40 cursor-not-allowed " +
          (checked
            ? "bg-(--color-primary) border-(--color-primary)"
            : "border-(--color-border) bg-transparent")
        );
      }
      return (
        base +
        "cursor-pointer " +
        (checked
          ? "bg-(--color-primary) border-(--color-primary)"
          : "border-(--color-border) bg-transparent hover:border-(--color-primary)")
      );
    },
  );

  /** Checkmark görünürlüğü için opacity computed'ı */
  checkmarkOpacity = computed(
    [this.properties.checked],
    ([checked]: [boolean]) => (checked ? "1" : "0"),
  );

  private _toggle() {
    if (getStateValue(this.properties.disabled)) return;
    const next = !getStateValue(this.properties.checked);
    if (this.properties.checked instanceof State) {
      this.properties.checked.set(next);
    }
    this.properties.onChange?.(next);
  }

  render(): NeolitNode | NeolitNode[] {
    return (
      <label
        className="inline-flex items-center gap-2.5 select-none"
        style={{ cursor: getStateValue(this.properties.disabled) ? "not-allowed" : "pointer" }}
        onClick={() => this._toggle()}
      >
        {/* Custom checkbox kutusu */}
        <span
          role="checkbox"
          tabIndex={0}
          className={this.boxClass}
          onKeydown={(e: KeyboardEvent) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              this._toggle();
            }
          }}
        >
          {/* Checkmark – material-symbols */}
          <IconComponent
            {...materialSymbolsOutlined("check", "1", "0.85rem")}
            style={{
              opacity: this.checkmarkOpacity,
              transition: "opacity 150ms",
              color: "white",
            }}
          />
        </span>
        <span className="text-sm font-medium text-(--color-fg)">
          {this.properties.label}
        </span>
      </label>
    );
  }
}
