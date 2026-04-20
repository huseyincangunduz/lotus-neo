import { NeolitComponent, state, type StateOrPlain, computed } from "@ubs-platform/neolit/core";
import { fromState } from "@ubs-platform/neolit/structural";

export interface IconProperties {
    iconClass: StateOrPlain<string>;
    iconContent: StateOrPlain<string>;
    iconImgSource: StateOrPlain<string>;
    iconSvgSource: StateOrPlain<string>;
}

export class IconComponent extends NeolitComponent {
    iconClass = state<string>("");
    iconContent = state<string>("");
    iconImgSource = state<string>("");
    iconSvgSource = state<string>("");
    combineContentAndClass = computed([this.iconContent, this.iconClass], () => this.iconContent.get() && this.iconClass.get());

    constructor({ iconClass, iconContent, iconImgSource, iconSvgSource }: IconProperties) {
        super();
        this.iconClass.set(iconClass);
        this.iconContent.set(iconContent);
        this.iconImgSource.set(iconImgSource);
        this.iconSvgSource.set(iconSvgSource);
    }


    render() {
        return (
            <>
                
                {fromState(this.combineContentAndClass).renderIf(() => {
                    return <span className={this.iconClass}>{this.iconContent}</span>
                })}
                
                {fromState(this.iconSvgSource).renderIf(svg => <img src={svg} alt="icon" className={this.iconClass.get()} />)}

                {fromState(this.iconImgSource).renderIf(() => {
                    return <img src={this.iconImgSource} alt="icon" className={this.iconClass} />
                })}

            </>
        );
    }
}