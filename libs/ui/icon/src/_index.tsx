import {
  NeolitComponent,
  state,
  type StateOrPlain,
  computed,
  getStateValue,
} from "@ubs-platform/neolit/core";
import { fromState } from "@ubs-platform/neolit/structural";

export interface IconProperties {
  className?: StateOrPlain<string | null | undefined>;
  content?: StateOrPlain<string | null | undefined>;
  imgSrc?: StateOrPlain<string | null | undefined>;
  iconAlt?: StateOrPlain<string | null | undefined>;
  lineHeight?: StateOrPlain<string>;
  fontSize?: StateOrPlain<string>;
  imageWidth?: StateOrPlain<string>;
  imageHeight?: StateOrPlain<string>;
}

export const materialSymbolsOutlined = (
  content: StateOrPlain<string>,
  lineHeight?: StateOrPlain<string>,
  fontSize?: StateOrPlain<string>,
) => {
  return {
    className: "material-symbols-outlined",
    content,
    lineHeight: lineHeight || "0px",
    fontSize: fontSize || "1em",
  } as IconProperties;
};

export class IconComponent extends NeolitComponent {
  properties = {
    className: state<string | null | undefined>(null),
    content: state<string | null | undefined>(null),
    imgSrc: state<string | null | undefined>(null),
    iconAlt: state<string | null | undefined>(null),
    lineHeight: state<string | null | undefined>(null),
    fontSize: state<string | null | undefined>(null),
    imageWidth: state<string | null | undefined>(null),
    imageHeight: state<string | null | undefined>(null),
  };

  combineContentAndClass = computed(
    [this.properties.content, this.properties.className],
    ([content, className]) => content && className,
  );

  onInit(): void {
    // Kullanmamayı umuyordum ama fragment aligmentleri bozuyor... mecbur :d
    // Zaten büyük bir component değil, bu kadar kontrolü tek bir componentte toplamak daha mantıklı geldi.
    this.watchToRerender(this.combineContentAndClass);
    this.watchToRerender(this.properties.imgSrc);
  }

  render() {
    return this.combineContentAndClass.get() ? (
      <i
        class={getStateValue(this.properties.className) || undefined}
        style={{
          lineHeight: getStateValue(this.properties.lineHeight) || undefined,
          fontSize: getStateValue(this.properties.fontSize) || undefined,
        }}
      >
        {getStateValue(this.properties.content)}
      </i>
    ) : this.properties.imgSrc.get() ? (
      <img
        src={getStateValue(this.properties.imgSrc) || undefined}
        alt={getStateValue(this.properties.iconAlt) || undefined}
        style={{
          width: getStateValue(this.properties.imageWidth) || undefined,
          height: getStateValue(this.properties.imageHeight) || undefined,
        }}
      />
    ) : null;
  }
}
