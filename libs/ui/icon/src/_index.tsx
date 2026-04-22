import {
  NeolitComponent,
  state,
  type StateOrPlain,
  computed,
} from "@ubs-platform/neolit/core";
import { fromState } from "@ubs-platform/neolit/structural";

export interface IconProperties {
  className?: StateOrPlain<string | null | undefined>;
  content?: StateOrPlain<string | null | undefined>;
  imgSrc?: StateOrPlain<string | null | undefined>;
  iconAlt?: StateOrPlain<string | null | undefined>;
}

export class IconComponent extends NeolitComponent {
  properties = {
    className: state<string | null | undefined>(null),
    content: state<string | null | undefined>(null),
    imgSrc: state<string | null | undefined>(null),
    iconAlt: state<string | null | undefined>(null),
  };

  combineContentAndClass = computed(
    [this.properties.content, this.properties.className],
    ([content, className]) => content && className,
  );

  render() {
    return (
      <>
        {fromState(this.combineContentAndClass).renderIf(() => {
          return (
            <span className={this.properties.className}>
              {this.properties.content}
            </span>
          );
        })}

        {/* {fromState(this.svgSrc).renderIf(svg => <svg src={svg} alt="icon" className={this.className} />)} */}

        {fromState(this.properties.imgSrc).renderIf((img) => (
          <img
            src={img}
            alt={this.properties.iconAlt}
            className={this.properties.className}
          />
        ))}
      </>
    );
  }
}
