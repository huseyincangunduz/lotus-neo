import type { NeolitNode, StateOrPlain } from "@ubs-platform/neolit/core";

export interface BackgroundViewProperties {
  /**
   * Farklı arkaplan verilebilmesi için node verilebilir. Örn: hareketli resim, vs.
   * componentler bu node'u absoulute ve düşük z-index ile render ederler. Böylece arkaplan olarak kullanılabilir.
   */
  backgroundNode?: NeolitNode;
  backgroundStyles?: Record<string, StateOrPlain<string>>;
}

export function ImageBackgroundView(src: string, alt: string): NeolitNode {
  return (
    <div className="h-full w-full inset-0 overflow-hidden rounded-(--radius-md)">
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover object-center"
      />
    </div>
  );
}

export function GradientBackgroundView(): NeolitNode {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-white to-orange-50 rounded-(--radius-md)" />
  );
}
