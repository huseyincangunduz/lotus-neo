import { NeolitComponent, state, type StateOrPlain, computed } from "@ubs-platform/neolit/core";
import { fromState } from "@ubs-platform/neolit/structural";

export interface IconProperties {
    className?: StateOrPlain<string | null | undefined>;
    content?: StateOrPlain<string | null | undefined>;
    imgSrc?: StateOrPlain<string | null | undefined>;
    iconAlt?: StateOrPlain<string | null | undefined>;
}

export class IconComponent extends NeolitComponent {
    className = state<string | null | undefined>("");
    content = state<string | null | undefined>("");
    imgSrc = state<string | null | undefined>("");
    iconAlt = state<string | null | undefined>("");
    combineContentAndClass = computed([this.content, this.className], ([content, className]) => content && className);

    constructor({ className: iconClass, content: iconContent, imgSrc: iconImgSource, iconAlt: iconAltText }: IconProperties) {
        super();
        this.className.set(iconClass);
        this.content.set(iconContent);
        this.imgSrc.set(iconImgSource);
        this.iconAlt.set(iconAltText);
    }


    render() {
        return (
            <>
                {fromState(this.combineContentAndClass).renderIf(() => {
                    return <span className={this.className}>{this.content}</span>
                })}

                {/* {fromState(this.svgSrc).renderIf(svg => <svg src={svg} alt="icon" className={this.className} />)} */}

                {fromState(this.imgSrc).renderIf(img => <img src={img} alt={this.iconAlt} className={this.className} />)}
            </>
        );
    }
}