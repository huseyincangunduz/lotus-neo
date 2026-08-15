# Flood Fill Icin Kalici (Incremental) Mask Canvas Plani

Durum: dusunuluyor, henuz uygulanmadi.

## Problem

`XdrawFillUtils.rasterizeFillMask`, her `fillDye` cagrisinda katmandaki **tum**
elementleri (gecmisteki butun `draw` stroke'lari + onceki `fill` ring'leri)
sifirdan yeniden ciziyor, sonra `getImageData` ile senkron okuma yapiyor.

Sonuclari:

- Cizim maliyeti kullanicinin cizdigi eleman sayisiyla dogru orantili buyuyor;
  katman ne kadar doluysa her yeni boyama tiklamasi o kadar yavasliyor.
- `getImageData` mobil GPU'larda pipeline flush'a zorluyor (bilinen en pahali
  islemlerden biri), ve bu maliyet her cagrida tekrar odeniyor.
- Bu, mevcut profildeki en buyuk tekil maliyet noktasi (flood fill ve ring
  simplification'dan daha agir).

## Fikir: elementler eklendikce/cikarildikca guncellenen static mask canvas

`internalMaskCanvas`'i "her fillDye'da sifirdan ciz" yerine **kalici bir
world-space raster** haline getirmek:

- Katman basina (veya key'lenmis) bir `private static maskCanvas` +
  `maskContext` saklanir.
- Yeni bir element eklendiginde (`data-holder.ts` `elements.push(...)` /
  `fillDye` sonrasi `unshift(...)` noktalarinda) sadece **o element** mask
  canvas'ina cizilir; tum gecmis yeniden cizilmez.
- Element silindiginde/degistiginde (`XdrawDataUtils.removePointsAt` gibi)
  mask gecersiz sayilir ve o katman icin tek seferlik tam yeniden cizim
  tetiklenir (nadir yol, pahali olmasi sorun degil).
- `fillDye` cagrildiginda artik yeniden cizim yok; sadece ilgili bbox icin
  `getImageData` alinir (bu adim zaten kacinilmaz, cunku flood fill algoritmasi
  piksel verisine ihtiyac duyuyor).

## Ele alinmasi gereken noktalar

1. **Invalidation kaynaklari**: element ekleme/cikarma/tasima/undo-redo/import
   gibi katmanin `elements` dizisini disaridan degistiren her yol tespit
   edilmeli (`layer-manager.ts`, `data-holder.ts`, undo sistemi varsa).
2. **Coklu katman**: mask canvas katman basina tutulmali (`Map<layerId, canvas>`),
   aktif olmayan katmanlar icin gereksiz bellek tutmamak adina lazy olusturma +
   belki LRU/temizlik.
3. **Canvas boyutu buyumesi**: yeni elementler geldikce world bbox genisleyebilir;
   mask canvas'in mevcut icerigini kaybetmeden buyutulmesi gerekir (yeni,
   daha buyuk canvas olusturup eskisini `drawImage` ile kopyalamak, offset
   dikkatli hesaplanmali).
4. **Coordinate offset**: mevcut kod her `fillDye` cagrisinda `minX/minY`'yi
   yeniden hesaplayip transformu ona gore kuruyor (`-minX, -minY`). Kalici
   canvas'ta offset sabitlenmeli (ilk olusturuldugunda world origin'i sabit
   bir noktaya sabitleyip pad ile buyume payi birakmak, ya da buyudukce
   yeniden hizalamak).
5. **Ekranda basili canvas'i kullanma fikri elendi**: view-space'te (kamera
   scale/pan uygulanmis, viewport'a kirpilmis) oldugu icin world-space flood
   fill ile uyusmuyor; zoom yapilmisken veya sekil ekran disindayken yanlis/
   eksik sonuc (fill sizmasi) verir. Bu yuzden ayri, world-space'te sabit bir
   mask canvas gerekli.

## Beklenen kazanc

- `fillDye` maliyeti `O(tum gecmis element sayisi)` yerine `O(bbox alani)`'na
  duser (flood fill zaten bunu yapiyor); cizim + `getImageData` maliyeti
  sabaha kalir (yalnizca degisen kucuk bolge icin islem yapilir).
- Katman ne kadar dolarsa dolsun boyama tiklama gecikmesi sabit kalir (bugunku
  gibi katlanarak buyumez).

## Sonraki adim

Once invalidation noktalarinin tam listesi cikarilmali (`elements` dizisine
yazan tum yerler), sonra `XdrawFillUtils` + katman yasam dongusu (`layer-manager.ts`)
arasinda mask cache'i kim sahiplenecek karari verilmeli.
