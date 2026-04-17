import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";

export interface ButtonProps {
    label: string;
    onClick?: () => void;
}

export class Button extends NeolitComponent {
    label: string;
    onClick?: () => void;

    /**
     *
     */
    constructor({label, onClick}: ButtonProps) {
        super();
        this.label = label;
        this.onClick = onClick;
    }
    render(): NeolitNode | NeolitNode[] | NeolitComponent | null {
        return <button onClick={this.onClick}>{this.label}</button>
    }
}