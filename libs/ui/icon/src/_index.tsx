import {
  NeolitComponent,
  state,
  type StateOrPlain,
  computed,
  getStateValue,
} from "@ubs-platform/neolit/core";
import "material-symbols";
import "iconify-icon";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "iconify-icon": {
        icon?: string;
        width?: string | number;
        height?: string | number;
        style?: Record<string, string>;
        class?: string;
      };
    }
  }
}



export interface IconProperties {
  className?: StateOrPlain<string | null | undefined>;
  content?: StateOrPlain<string | null | undefined>;
  imgSrc?: StateOrPlain<string | null | undefined>;
  iconAlt?: StateOrPlain<string | null | undefined>;
  lineHeight?: StateOrPlain<string>;
  fontSize?: StateOrPlain<string>;
  imageWidth?: StateOrPlain<string>;
  imageHeight?: StateOrPlain<string>;
  /** fa-brands, mdi, vs. — "fa-brands:apple" gibi tam iconify adı */
  iconifyName?: string;
  color?: string;
  size?: string;
}

export const materialSymbolsOutlined = (
  content: StateOrPlain<string>,
  lineHeight?: StateOrPlain<string>,
  fontSize?: StateOrPlain<string>,
) => {
  return {
    className: "material-symbols-outlined",
    content,
    lineHeight: lineHeight || "1.25rem",
    fontSize: fontSize || "1.25rem",
  } as IconProperties;
};

/**
 * fa-brands prefix otomatik eklenir. Örn: iconifyIcon("apple") → "fa-brands:apple"
 * Farklı bir set için tam adı verin: iconifyIcon("mdi:home")
 */
export const iconifyIcon = (
  iconClass: string,
  size?: string,
  color?: string,
): IconProperties => {
  const iconifyName = iconClass.includes(":")
    ? iconClass
    : `fa-brands:${iconClass}`;
  return { iconifyName, size: size || "1.25rem", color } as IconProperties;
}

export class Icon extends NeolitComponent {
  properties = {
    className: state<string | null | undefined>(null),
    content: state<string | null | undefined>(null),
    imgSrc: state<string | null | undefined>(null),
    iconAlt: state<string | null | undefined>(null),
    lineHeight: state<string | null | undefined>(null),
    fontSize: state<string | null | undefined>(null),
    imageWidth: state<string | null | undefined>(null),
    imageHeight: state<string | null | undefined>(null),
    iconifyName: state<string | null | undefined>(null),
    color: state<string | null | undefined>(null),
    size: state<string | null | undefined>(null),
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
    this.watchToRerender(this.properties.iconifyName);
  }

  render() {
    const iconifyName = this.properties.iconifyName.get();
    const size = getStateValue(this.properties.size) || getStateValue(this.properties.fontSize) || "1.25rem";
    const color = getStateValue(this.properties.color);

    if (iconifyName) {
      return (
        <iconify-icon
          icon={iconifyName}
          width={size}
          height={size}
          style={color ? { color } : undefined}
        ></iconify-icon>
      );
    }

    return this.combineContentAndClass.get() ? (
      <i
        class={getStateValue(this.properties.className) || undefined}
        style={{
          lineHeight: getStateValue(this.properties.lineHeight) || undefined,
          fontSize: getStateValue(this.properties.fontSize) || undefined,
          color: color || undefined,
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

// Alias for simpler imports
export const IconComponent = Icon;