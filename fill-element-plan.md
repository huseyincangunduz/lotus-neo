# Flood Fill Element Refactor Plani

Durum: planlandi, henuz uygulanmadi.

## Problem

`XdrawFillUtils.fillDye` flood fill sonucunu `convertFilledPixelsToDrawElements` ile
yuzlerce/binlerce ayri `XDrawDrawElement`'e patlatiyor. Sonuclari:

- `XDrawData` JSON'u sisiyor (autosave + export + her undo snapshot'i deep copy).
- Render dongusu bos yere binlerce element geziyor.
- Tek bir "dolgu" kullanici acisindan tek nesne olmasi gerekirken parcali duruyor.

## Karar: nokta depolamasi array olarak kalir

`Map<x, Map<y, ...>>` gibi bir yapiya gecilmeyecek. Gerekceler:

- `points` sirali bir polyline; sira = cizginin kendisi. Map key sirayi yok eder.
- Key'lemek float world koordinatini quantize etmeyi zorunlu kilar, vektor zoom kalitesi olur.
- Ayni koordinat farkli `size` (basinc) ile tekrar edebilir, duplicate mesru.
- Bellek ve JSON boyutu array'e gore ~10-20x kotu.
- Gelecek `image` / `text` elementleri zaten nokta listesi degil.

Performans ihtiyaci ortaya cikarsa cozum depolama formatini degistirmek degil,
**turetilmis (serialize edilmeyen) uzamsal index** eklemek: element basina cache'li
bbox + uniform grid (`Map<cellKey, XDrawElement[]>`, hucre ~64 world unit).

## Hedef veri yapisi

`xdraw-data.ts` icine:

```ts
export interface XDrawPoint {
    x: number;
    y: number;
}

// Ilk ring dis sinir, sonraki ring'ler delik. evenodd kurali ile doldurulur.
export interface XDrawFillElement extends XDrawElement {
    type: "fill";
    color: string;
    rings: XDrawPoint[][];
    seed?: XDrawPoint; // ileride "dolguyu tazele" icin metadata
}
```

`closePath: true` bayragi `XDrawDrawElement`'e **eklenmeyecek**:

- Delikli bolgeleri (ornek: "O" harfinin ici) ifade edemez.
- Flood fill birden cok kopuk bolge uretebilir.
- `size` alani dolgu icin anlamsiz, bosuna tasinir.
- `draw` stroke semantigi tasiyor; bayrak her `type === "draw"` blogunu ikiye boler.

## Mask -> ring donusumu

Girdi olarak mevcut `floodFillMask` ciktisi (`Uint8Array` visited) yeterli.
`convertFilledPixelsToDrawElements` yerine:

1. Mask'i **1-2 piksel dilate et** (stroke antialias kenariyla dolgu arasinda
   sac teli bosluk kalmasin diye).
2. **Marching squares** ile bagli bilesenlerin konturlarini izle -> kapali ring'ler.
3. **Ramer-Douglas-Peucker** ile sadelestir (epsilon ~0.5-1 world unit).
   Binlerce noktadan tipik 50-300 noktaya iner.
4. Her bagli bilesen icin tek `XDrawFillElement`; ic halkalar ayni element'in
   `rings` dizisine delik olarak eklenir.

Cozunurluk notu: `rasterizeFillMask` su an 1 mask pikseli = 1 world unit calisiyor.
Yuksek zoom'da kontur koseli gorunur. Mask'i 2x scale ile rasterize edip kontur
koordinatlarini geri bolerek iyilestirilebilir.

Z-order notu: fill element'i stroke'larin **altina** eklenmeli (elements dizisinde
once), yoksa dolgu cizgi kenarlarini kapatir.

## Render

`data-rasterizer.ts` icinde tek `Path2D`:

```ts
const path = new Path2D();
for (const ring of fill.rings) {
    path.moveTo(ring[0].x, ring[0].y);
    for (let i = 1; i < ring.length; i++) path.lineTo(ring[i].x, ring[i].y);
    path.closePath();
}
context.fillStyle = color;
context.fill(path, "evenodd");
```

`Path2D` nesnesi element id'sine gore cache'lenmeli; her frame yeniden kurulmamali.

## Yeni tip eklemenin kiracagi yerler

Bunlar fill element'i eklenir eklenmez bozulur, ayni PR'da duzeltilmeli:

- `XdrawDataUtils.cropXDrawDataElements` -> `"draw"` olmayani eliyor, fill'ler hic
  render edilmez.
- `XdrawDataUtils.findBoundingBox` -> fill'leri saymaz, sonraki flood fill'in mask
  siniri yanlis cikar.
- `XdrawDataUtils.removePointsAt` (silgi) -> ring'ten nokta silmek delik acmaz,
  ring'i kisa devre yapip sekli bozar.
- `XdrawFillUtils.rasterizeFillMask` -> mask'i cizerken fill element'lerini de
  bariyer olarak cizmeli.

## Onerilen mimari: element geometry registry

`image` / `text` gelmeden once yapilmasi en karli refactor. Dagilmis
`element.type === "draw"` kontrollerini tek yere toplar.

```ts
interface ElementGeometry {
    bounds(el: XDrawElement): { minX: number; minY: number; maxX: number; maxY: number };
    intersects(el: XDrawElement, rect: Rect): boolean;
    render(ctx: CanvasRenderingContext2D, el: XDrawElement): void;
    erase(el: XDrawElement, x: number, y: number, r: number): XDrawElement | null;
}
```

`Record<string, ElementGeometry>` registry; `draw` ve `fill` kaydolur, sonra
`image` / `text` tek dosya ekleyerek katilir. `cropXDrawData`, `findBoundingBox`,
`ProjectDataRasterizer` ve silgi bu registry uzerinden calisir.

Fill icin `erase` baslangic stratejisi: silgi bir fill'e degdiyse fill'i komple sil.
Sonraki asamada silinen daireyi ring listesine delik olarak ekle veya yeniden
rasterize edip boolean subtract yap.

## Temizlik

`XdrawFillUtils.allEmptyFillablePoints` ve `fillPoints` olu/eski yol gorunuyor
(yaricap 5 ve `size: 10` hardcoded). `XdrawDataUtils` uzerindeki proxy'leriyle
birlikte silinebilir.

## Ek performans isi (ayri, opsiyonel)

`rasterizeFillMask` her fill'de tum dokuman bbox'i icin mask uretiyor.
Viewport + padding ile sinirla, `imageData`'yi cache'le, cizim degisince dirty
isaretle.

## Onerilen sira

1. Element geometry registry (`draw` icin mevcut davranisi tasiyarak).
2. `XDrawFillElement` tipi + `Path2D` render + registry kaydi.
3. Marching squares + RDP ile mask -> ring donusumu; `convertFilledPixelsToDrawElements` kaldirilir.
4. Silgi / crop / bbox davranislarini fill icin tamamla.
5. Olu fill kodu temizligi, mask cache.
