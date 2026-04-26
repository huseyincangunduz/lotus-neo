import {
  computed,
  getStateValue,
  NeolitComponent,
  state,
  type NeolitNode,
  type StateOrPlain,
  State,
} from "@ubs-platform/neolit/core";

export interface ToggleSwitchProps {
  /** Switch'in aktif/pasif durumu */
  checked?: StateOrPlain<boolean>;
  /** Etiket metni */
  label?: StateOrPlain<string>;
  /** Switch devre dışı mı? */
  disabled?: StateOrPlain<boolean>;
  /** Durum değiştiğinde çağrılır */
  onChange?: (checked: boolean) => void;
}

export class ToggleSwitch extends NeolitComponent<ToggleSwitchProps> {
  properties = {
    checked: state<boolean>(false),
    label: state<string>(""),
    disabled: state<boolean>(false),
    onChange: (_v: boolean) => {},
  };

  trackClass = computed(
    [this.properties.checked, this.properties.disabled],
    ([checked, disabled]: [boolean, boolean]) => {
      const base =
        "relative inline-flex items-center h-6 w-11 rounded-full " +
        "transition-colors duration-200 ease-in-out focus-visible:outline-none ";
      if (disabled) {
        return (
          base +
          "opacity-40 cursor-not-allowed " +
          (checked ? "bg-(--color-primary)" : "bg-gray-300 dark:bg-gray-600")
        );
      }
      return (
        base +
        "cursor-pointer " +
        (checked ? "bg-(--color-primary)" : "bg-gray-300 dark:bg-gray-600")
      );
    },
  );

  thumbClass = computed(
    [this.properties.checked],
    ([checked]: [boolean]) =>
      "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md " +
      "ring-0 transition-transform duration-200 ease-in-out " +
      (checked ? "translate-x-6" : "translate-x-1"),
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
        className="inline-flex items-center gap-3 select-none"
        style={{ cursor: getStateValue(this.properties.disabled) ? "not-allowed" : "pointer" }}
        onClick={() => this._toggle()}
      >
        <span
          role="switch"
          tabIndex={0}
          className={this.trackClass}
          onKeydown={(e: KeyboardEvent) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              this._toggle();
            }
          }}
        >
          <span className={this.thumbClass} />
        </span>
        <span className="text-sm font-medium text-(--color-fg)">
          {this.properties.label}
        </span>
      </label>
    );
  }
}
