import {
  computed,
  getStateValue,
  isState,
  NeolitComponent,
  state,
  type NeolitNode,
  type State,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";

export interface AccordionProps {
  title: StateOrPlain<NeolitNode | string>;
  children: NeolitNode | NeolitNode[];
  open?: StateOrPlain<boolean>;
  defaultOpen?: StateOrPlain<boolean>;
  onToggle?: (open: boolean) => void;
  className?: StateOrPlain<string>;
  headerClassName?: StateOrPlain<string>;
  contentClassName?: StateOrPlain<string>;
}

export class Accordion extends NeolitComponent<AccordionProps> {
  properties: AccordionProps = {
    title: "",
    children: <></>,
    open: undefined,
    defaultOpen: false,
    onToggle: () => {},
    className: "",
    headerClassName: "",
    contentClassName: "",
  };

  private localOpen = state<boolean>(false);

  private isExpanded = computed([this.localOpen], ([open]) => open);

  private panelClassName = computed([this.isExpanded], ([open]) =>
    open
      ? "grid grid-rows-[1fr] opacity-100 transition-all duration-200"
      : "grid grid-rows-[0fr] opacity-70 transition-all duration-200",
  );

  private iconRotationClass = computed([this.isExpanded], ([open]) =>
    open ? "rotate-180" : "rotate-0",
  );

  onInit(): void {
    if (isState(this.properties.open)) {
      this.localOpen.set((this.properties.open as State<boolean>).get());
      (this.properties.open as State<boolean>).subscribe((value) => {
        this.localOpen.set(value);
      });
      return;
    }

    if (typeof this.properties.open === "boolean") {
      this.localOpen.set(this.properties.open);
      return;
    }

    this.localOpen.set(getStateValue(this.properties.defaultOpen ?? false));
  }

  private toggle() {
    const next = !this.localOpen.get();

    if (isState(this.properties.open)) {
      (this.properties.open as State<boolean>).set(next);
    } else {
      this.localOpen.set(next);
    }

    this.properties.onToggle?.(next);
  }

  render(): NeolitNode {
    return (
      <section
        className={[
          "rounded-(--radius-sm) border border-(--color-border)",
          this.properties.className,
        ]}
      >
        <button
          type="button"
          className={[
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-(--color-fg) hover:bg-(--color-surface-1)",
            this.properties.headerClassName,
          ]}
          onClick={() => this.toggle()}
          aria-expanded={this.isExpanded}
        >
          <span>{this.properties.title}</span>
          <i
            className={[
              "material-symbols-outlined text-base leading-none transition-transform duration-200",
              this.iconRotationClass,
            ]}
          >
            expand_more
          </i>
        </button>

        <div className={this.panelClassName}>
          <div
            className={[
              "min-h-0 overflow-hidden border-t border-(--color-border)",
              this.properties.contentClassName,
            ]}
          >
            {this.properties.children}
          </div>
        </div>
      </section>
    );
  }
}
