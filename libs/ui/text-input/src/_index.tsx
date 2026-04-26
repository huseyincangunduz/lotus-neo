import {
  computed,
  NeolitComponent,
  state,
  State,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";
import { fromState } from "@ubs-platform/neolit/structural";

export type TextInputType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "tel"
  | "url"
  | "search";

export interface TextInputProps {
  /** Input'un label metni */
  label?: StateOrPlain<string>;
  /** Input'un değeri (iki yönlü bağlama için State<string> ver) */
  value?: StateOrPlain<string>;
  /** Input tipi – text, email, password, number vs. */
  type?: StateOrPlain<TextInputType>;
  /** Placeholder metni */
  placeholder?: StateOrPlain<string>;
  /** Hata mesajı – dolu olduğunda input hata stiline girer */
  error?: StateOrPlain<string | null | undefined>;
  /** Input devre dışı mı? */
  disabled?: StateOrPlain<boolean>;
  /** Değer değiştiğinde çağrılır */
  onChange?: (value: string) => void;
  /** Blur olduğunda çağrılır */
  onBlur?: () => void;
}

export class TextInput extends NeolitComponent<TextInputProps> {
  properties = {
    label: state<string>(""),
    value: state<string>(""),
    type: state<TextInputType>("text"),
    placeholder: state<string>(""),
    error: state<string | null | undefined>(null),
    disabled: state<boolean>(false),
    onChange: (_v: string) => {},
    onBlur: () => {},
  };

  hasError = computed(
    [this.properties.error],
    ([err]: Array<string | null | undefined>) => !!err,
  );

  hasLabel = computed(
    [this.properties.label],
    ([label]: string[]) => !!label,
  );

  inputClass = computed(
    [this.hasError, this.properties.disabled],
    ([hasError, disabled]: [boolean, boolean]) => {
      const base =
        "w-full px-3 py-2 rounded-md text-sm outline-none transition-all duration-150 " +
        "bg-(--color-surface-1) text-(--color-fg) border " +
        "focus:ring-2 ";
      if (disabled) {
        return base + "border-(--color-border) opacity-50 cursor-not-allowed";
      }
      if (hasError) {
        return base + "border-red-500 focus:ring-red-400/30 focus:border-red-500";
      }
      return (
        base +
        "border-(--color-border) focus:ring-(--color-primary)/30 focus:border-(--color-primary)"
      );
    },
  );

  render(): NeolitNode | NeolitNode[] {
    return (
      <div className="flex flex-col gap-1 w-full">
        {fromState(this.hasLabel).renderIf(() => (
          <label className="text-xs font-medium text-(--color-fg) opacity-70 select-none">
            {this.properties.label}
          </label>
        ))}
        <input
          type={this.properties.type}
          value={this.properties.value}
          placeholder={this.properties.placeholder}
          disabled={this.properties.disabled}
          className={this.inputClass}
          onInput={(e: Event) => {
            const val = (e.target as HTMLInputElement).value;
            if (this.properties.value instanceof State) {
              this.properties.value.set(val);
            }
            this.properties.onChange?.(val);
          }}
          onBlur={() => {
            this.properties.onBlur?.();
          }}
        />
        {fromState(this.hasError).renderIf(() => (
          <span className="text-xs text-red-500 font-medium leading-tight">
            {this.properties.error}
          </span>
        ))}
      </div>
    );
  }
}
