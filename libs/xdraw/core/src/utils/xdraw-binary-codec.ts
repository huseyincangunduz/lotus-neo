import type {
    XDrawData,
    XDrawDrawElement,
    XDrawElement,
    XDrawElementPosition,
    XDrawFillElement,
    XDrawLayer,
    XDrawPoint,
} from "./xdraw-data";

// Undo/redo yigininin en agir kismi points/rings dizileridir. Bunlari JSON metni
// yerine dogrudan Float32Array'e yaziyoruz: stringify/parse'daki sayi<->metin
// donusumu (ana takilma sebebi) tamamen ortadan kalkiyor, sadece typed array
// kopyalama (memcpy benzeri) kaliyor. id/color/flag gibi kucuk alanlar
// (eleman sayisi kadar, nokta sayisi kadar degil) hala hafif bir JS objesinde.

const FLOATS_PER_DRAW_POINT = 4; // x, y, size, breakBefore(0/1)
const FLOATS_PER_RING_POINT = 2; // x, y

// Draw elemanının points dizisindeki her noktanın buffer'daki sayısal karşılığı;
// id/color/finalized gibi alanlar burada yok, onlar skeleton tarafında.
interface XDrawSkeletonElementDraw {
    kind: "draw";
    id: string;
    color: string;
    finalized?: boolean;
    partial?: boolean;
    // decode sirasinda buffer'dan kac nokta okunacagini belirtir (offset hesaba katilmaz, sirali okunur).
    pointCount: number;
}

// Fill elemanının rings (ve varsa seed) noktaları buffer'a yazılır; ringLengths
// olmadan decode hangi ring'in kaç noktadan oluştuğunu bilemez (rings iç içe dizi).
interface XDrawSkeletonElementFill {
    kind: "fill";
    id: string;
    color: string;
    partial?: boolean;
    // seed noktasi buffer'a yazildi mi bilgisini tasir (opsiyonel oldugu icin pointCount gibi sabit degil).
    hasSeed: boolean;
    ringLengths: number[];
}

// Ileride eklenebilecek bilinmeyen eleman tipleri icin guvenli dusus: aynen JSON'a gomulur.
interface XDrawSkeletonElementRaw {
    kind: "raw";
    element: XDrawElement;
}

type XDrawSkeletonElement = XDrawSkeletonElementDraw | XDrawSkeletonElementFill | XDrawSkeletonElementRaw;

interface XDrawSkeletonLayer {
    id: string;
    opacity?: number;
    visible?: boolean;
    // currentSessionActive?: boolean;
    elements: XDrawSkeletonElement[];
}

// data-holder.ts'teki XDrawHistorySnapshot bu tipi tasir; encode/decode arasinda
// sadece bu skeleton + Float32Array ciftinin JSON.stringify/parse'a hic girmemesi hedeflenir.
export interface XDrawSkeleton {
    layers: XDrawSkeletonLayer[];
}

// XDrawData -> (skeleton, buffer). Iki gecis yapar: once toplam float sayisini
// hesaplayip buffer'i TEK seferde ve dogru boyutta ayirir (buyume/kopyalama olmasin
// diye), sonra ayni sirayla gezip sayilari buffer'a yazar. Skeleton ve buffer'daki
// elemanlar/nokta gruplari AYNI SIRADA olusturulur; decode bu sira varsayimina gore okur.
export function encodeXDrawDataToBuffer(data: XDrawData): { skeleton: XDrawSkeleton; buffer: Float32Array; } {
    // 1. gecis: sadece boyut hesabi, henuz yazma yok.
    let totalFloats = 0;
    for (const layer of data.layers) {
        for (const element of layer.elements) {
            if (element.type === "draw") {
                totalFloats += (element as XDrawDrawElement).points.length * FLOATS_PER_DRAW_POINT;
            }
            else if (element.type === "fill") {
                const fill = element as XDrawFillElement;
                for (const ring of fill.rings) {
                    totalFloats += ring.length * FLOATS_PER_RING_POINT;
                }
                if (fill.seed) {
                    totalFloats += FLOATS_PER_RING_POINT;
                }
            }
            // "raw" (bilinmeyen tip) icin buffer'a hicbir sey yazilmaz, boyuta da eklenmez.
        }
    }

    const buffer = new Float32Array(totalFloats);
    // 2. gecis sirasinda buffer'in neresine yazildigini takip eden tek sayac;
    // skeleton agaci olusturulurken (map icinde) yan etki olarak ilerletilir.
    let offset = 0;

    const layers: XDrawSkeletonLayer[] = data.layers.map((layer) => ({
        id: layer.id,
        opacity: layer.opacity,
        visible: layer.visible,
        elements: layer.elements.map((element): XDrawSkeletonElement => {
            if (element.type === "draw") {
                const draw = element as XDrawDrawElement;
                // Her nokta 4 float olarak sirayla yazilir; metne cevirme/parse yok.
                for (const point of draw.points) {
                    buffer[offset++] = point.x;
                    buffer[offset++] = point.y;
                    buffer[offset++] = point.size;
                    buffer[offset++] = point.breakBefore ? 1 : 0;
                }
                return {
                    kind: "draw",
                    id: draw.id,
                    color: draw.color,
                    finalized: draw.finalized,
                    partial: draw.partial,
                    pointCount: draw.points.length,
                };
            }
            if (element.type === "fill") {
                const fill = element as XDrawFillElement;
                // ringLengths, decode'un buffer'i hangi sinirlarda ring'lere bolecegini soyler.
                const ringLengths = fill.rings.map((ring) => ring.length);
                for (const ring of fill.rings) {
                    for (const point of ring) {
                        buffer[offset++] = point.x;
                        buffer[offset++] = point.y;
                    }
                }
                let hasSeed = false;
                if (fill.seed) {
                    // seed varsa ringlerden HEMEN SONRA yazilir; decode ayni sirayla okur.
                    buffer[offset++] = fill.seed.x;
                    buffer[offset++] = fill.seed.y;
                    hasSeed = true;
                }
                return {
                    kind: "fill",
                    id: fill.id,
                    color: fill.color,
                    partial: fill.partial,
                    hasSeed,
                    ringLengths,
                };
            }
            // Bilinmeyen tip: oldugu gibi JSON'a gomulur, buffer'dan hicbir pay almaz.
            return { kind: "raw", element };
        }),
    }));

    return { skeleton: { layers }, buffer };
}

// encodeXDrawDataToBuffer'in tersi. offset ayni sirayla ilerletilir; skeleton'daki
// pointCount/ringLengths sayesinde her elemanin buffer'dan kac float okuyacagi
// onceden bilinir, ayrica offset bilgisi tasimaya gerek kalmaz.
export function decodeXDrawDataFromBuffer(skeleton: XDrawSkeleton, buffer: Float32Array): XDrawData {
    let offset = 0;

    const layers: XDrawLayer[] = skeleton.layers.map((skLayer) => {
        const elements: XDrawElement[] = skLayer.elements.map((skElement) => {
            if (skElement.kind === "draw") {
                // pointCount ile dizi onceden dogru boyutta ayrilir (push yerine index atamasi, daha hizli).
                const points: XDrawElementPosition[] = new Array(skElement.pointCount);
                for (let i = 0; i < skElement.pointCount; i++) {
                    const x = buffer[offset++];
                    const y = buffer[offset++];
                    const size = buffer[offset++];
                    const breakBefore = buffer[offset++] !== 0;
                    // breakBefore false ise alanin kendisini bile eklemiyoruz (encode oncesi ile ayni obje sekli).
                    points[i] = breakBefore ? { x, y, size, breakBefore: true } : { x, y, size };
                }
                const draw: XDrawDrawElement = {
                    id: skElement.id,
                    type: "draw",
                    color: skElement.color,
                    points,
                };
                // undefined alanlari objeye hic eklemiyoruz; JSON.stringify ile ayni davranisi korur (key yoksa serialize de yok).
                if (skElement.finalized !== undefined) draw.finalized = skElement.finalized;
                if (skElement.partial !== undefined) draw.partial = skElement.partial;
                return draw;
            }
            if (skElement.kind === "fill") {
                // Her ring, ringLengths[i] kadar nokta okuyarak sirayla olusturulur.
                const rings: XDrawPoint[][] = skElement.ringLengths.map((length) => {
                    const ring: XDrawPoint[] = new Array(length);
                    for (let i = 0; i < length; i++) {
                        ring[i] = { x: buffer[offset++], y: buffer[offset++] };
                    }
                    return ring;
                });
                const fill: XDrawFillElement = {
                    id: skElement.id,
                    type: "fill",
                    color: skElement.color,
                    rings,
                };
                if (skElement.partial !== undefined) fill.partial = skElement.partial;
                if (skElement.hasSeed) {
                    // encode tarafinda seed ringlerden hemen sonra yazilmisti, ayni sirayla okunur.
                    fill.seed = { x: buffer[offset++], y: buffer[offset++] };
                }
                return fill;
            }
            // "raw" tip encode sirasinda oldugu gibi saklanmisti, dogrudan geri dondurulur.
            return skElement.element;
        });

        const resultLayer: XDrawLayer = { id: skLayer.id, type: "layer", elements };
        if (skLayer.opacity !== undefined) resultLayer.opacity = skLayer.opacity;
        if (skLayer.visible !== undefined) resultLayer.visible = skLayer.visible;
        return resultLayer;
    });

    return { layers };
}

// Skeleton, nokta/ring verisi icermedigi icin (kucuk) JSON.stringify ile kiyaslamak burada pahali degildir.
export function xdrawSkeletonsEqual(a: XDrawSkeleton, b: XDrawSkeleton): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

// Asil buyuk veri burada oldugu icin string'e cevirmeden, sayi sayi karsilastirir.
export function xdrawBuffersEqual(a: Float32Array, b: Float32Array): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
