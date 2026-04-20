import { computed, NeolitComponent, state, type NeolitNode, type StateOrPlain } from "@ubs-platform/neolit/core";
export interface ButtonProps {
    label: StateOrPlain<string>;
    onClick?: () => void;
    // tailwind'in varsayılan renk paletini baz alarak primary, secondary ve tertiary olmak üzere üç farklı buton varyantı tanımladım. İleride ihtiyaç duyulursa bu varyantlara yeni stiller eklenebilir veya mevcut stiller güncellenebilir.
    variant?: StateOrPlain<"primary" | "secondary" | "tertiary">;
    visual?: StateOrPlain<"filled" | "outline" | "ghost">;
}

export class Button extends NeolitComponent {
    label = state<string>("");
    onClick?: () => void;
    variant = state<"primary" | "secondary" | "tertiary">("primary");
    visual = state<"filled" | "outline" | "ghost">("filled");
    buttonClassName = computed([this.variant, this.visual], () => {
        const variantClass = {
            primary: "bg-blue-500 text-white hover:bg-blue-600",
            secondary: "bg-gray-500 text-white hover:bg-gray-600",
            tertiary: "bg-transparent text-gray-500 hover:bg-gray-100",
        }[this.variant.get()];

        const visualClass = {
            filled: "",
            outline: "border border-current bg-transparent",
            ghost: "bg-transparent",
        }[this.visual.get()];

        return `px-4 py-2 rounded-sm ${variantClass} ${visualClass}`;
    });
    /**
     *
     */
    constructor({label, onClick, variant, visual}: ButtonProps) {
        super();
        this.label.set(label);
        this.onClick = onClick;
        this.variant.set(variant || "primary");
        this.visual.set(visual || "filled");
    }
    render(): NeolitNode | NeolitNode[] | NeolitComponent | null {
        return <button className={this.buttonClassName.get()} onClick={this.onClick}>{this.label}</button>
    }
}