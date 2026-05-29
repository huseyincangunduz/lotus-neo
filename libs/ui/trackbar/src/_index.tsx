import {
  computed,
  NeolitComponent,
  state,
  State,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";

export interface TrackbarProps {
  label?: StateOrPlain<string>;
  value?: StateOrPlain<number>;
  min?: StateOrPlain<number>;
  max?: StateOrPlain<number>;
  step?: StateOrPlain<number>;
  disabled?: StateOrPlain<boolean>;
  showValue?: StateOrPlain<boolean>;
  onChange?: (value: number) => void;
}

export class Trackbar extends NeolitComponent<TrackbarProps> {
  properties = {
    label: state<string>(""),
    value: state<number>(0),
    min: state<number>(0),
    max: state<number>(100),
    step: state<number>(1),
    disabled: state<boolean>(false),
    showValue: state<boolean>(true),
    onChange: (_v: number) => {},
  };

  hasLabel = computed(
    [this.properties.label],
    ([label]: string[]) => !!label,
  );

  fillPercent = computed(
    [this.properties.value, this.properties.min, this.properties.max],
    ([value, min, max]: [number, number, number]) => {
      if (max <= min) return 0;
      const clamped = Math.min(Math.max(value, min), max);
      return ((clamped - min) / (max - min)) * 100;
    },
  );

  trackStyle = computed(
    [this.fillPercent],
    ([fillPercent]: [number]) => ({
      background: `linear-gradient(90deg, var(--color-primary) ${fillPercent}%, var(--color-border) ${fillPercent}%)`,
    }),
  );

  private _handleInput(nextValue: number) {
    if (this.properties.value instanceof State) {
      this.properties.value.set(nextValue);
    }
    this.properties.onChange?.(nextValue);
  }

  render(): NeolitNode | NeolitNode[] {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center justify-between gap-3">
          {this.hasLabel.get() && (
            <label className="text-xs font-medium text-(--color-fg) opacity-70 select-none">
              {this.properties.label}
            </label>
          )}
          {this.properties.showValue && (
            <span className="text-xs font-medium text-(--color-fg) opacity-80 tabular-nums min-w-[3ch] text-right">
              {this.properties.value}
            </span>
          )}
        </div>
        <input
          type="range"
          min={this.properties.min}
          max={this.properties.max}
          step={this.properties.step}
          value={this.properties.value}
          disabled={this.properties.disabled}
          className={
            "w-full h-2 rounded-lg appearance-none outline-none transition-opacity duration-150 " +
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-(--color-primary) " +
            "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-(--color-surface) " +
            "[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer " +
            "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full " +
            "[&::-moz-range-thumb]:bg-(--color-primary) [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer " +
            "disabled:opacity-50 disabled:cursor-not-allowed"
          }
          style={this.trackStyle}
          onInput={(e: Event) => {
            const nextValue = Number((e.target as HTMLInputElement).value);
            this._handleInput(nextValue);
          }}
          onChange={(e: Event) => {
            const nextValue = Number((e.target as HTMLInputElement).value);
            this._handleInput(nextValue);
          }}
        />
      </div>
    );
  }
}
