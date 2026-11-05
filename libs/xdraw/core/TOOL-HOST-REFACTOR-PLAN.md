# Araç host'u refactor planı (taslak)

> Durum: fikir aşamasında, henüz başlanmadı. Daha sonra konuşulup netleşecek.

## Sorun

`CanvasDrawTools` ve araçlar (`PenTool`, `EraserTool`, `ShapeTool`, `MoveTool`, `SelectionTool`, `FillTool`) bileşenin kendisini (`new CanvasDrawTools(this)`) `CanvasDrawToolHost` olarak alıyor. Bu arayüzde birbirinden farklı sorumluluklar aynı yerde duruyor:

| Grup | Üyeler |
| --- | --- |
| Koordinat / kamera | `getCanvasPointInViewBox`, `zoomFactor`, `clickedCameraX`, `clickedCameraY` |
| Doküman | `svgHolder` |
| Geçmiş (undo/redo) | `captureHistorySnapshot`, `pushHistorySnapshotOperation`, `beginGestureHistoryCapture`, `finishGestureHistoryCapture`, `restoreHistorySnapshot` |
| Ayarlar | `settings` |
| Arayüz | `promptForTextAt` |
| Araçlara ait geçici durum | `smoothedPressure`, `lastDrawPoint`, `lastErasePoint` |

En çok kafa karıştıran son grup. Bunlar aslında kalem ve silginin kendi durumu ama bileşenin üzerinde duruyorlar. Bir aracı okurken "bu değer nerede değişiyor?" diye bileşene gidip gelmek gerekiyor.

## Adımlar

Her adım tek başına yapılabilir ve kendi içinde tamamlanır. Sırayla gitmek en az riskli yol.

### 1. Geçici durumu araçlara taşımak (en kolay, en çok rahatlatan)

- `lastDrawPoint` ve `smoothedPressure` → `PenTool` içinde private alan.
- `lastErasePoint` → `EraserTool` içinde private alan.
- Şu an sıfırlamalar `CanvasDrawTools.finishInteraction` ve `MoveTool.finish` içinde yapılıyor. Bunun yerine her araç kendi `finish`/`cancel` metodunda sıfırlasın.
- Dikkat: bileşen `onPointerDown` içinde `smoothedPressure`'a başlangıç basıncını yazıyor (`canvas-draw.tsx`). Bu değer `PenTool.start(..., pressure)` parametresi olarak verilmeli.
- Sonuç: davranış değişmez, host arayüzünden 3 alan çıkar.

### 2. Host'u küçük portlara bölmek

Tek büyük arayüz yerine:

```ts
interface ToolViewport {
    toWorld(offsetX: number, offsetY: number): XDrawPoint; // getCanvasPointInViewBox
    zoom(): number;
}

interface ToolHistory {
    capture(): XDrawHistorySnapshot;
    push(before: XDrawHistorySnapshot, after: XDrawHistorySnapshot): void;
    restore(snapshot: XDrawHistorySnapshot): Promise<void>;
    beginGesture(): void;
    finishGesture(): void;
}

interface ToolUi {
    promptForTextAt(offsetX: number, offsetY: number): void;
}

interface ToolContext {
    viewport: ToolViewport;
    document: XDrawDataHolder;
    history: ToolHistory;
    settings: XDrawSettingsConfig;
    ui: ToolUi;
}
```

- Her araç sadece ihtiyacı olanı alır. Örneğin `ShapeTool` → `viewport + document + history + settings`; `ui`'yi hiç görmez.
- `clickedCameraX/Y` pan için kullanılıyor; bu tamamen bileşende kalabilir mi, ona bakılmalı.
- Testlerdeki sahte host'lar (`tests/shapes.test.mjs`) da küçülür. Her test sadece ilgili portu taklit eder.

### 3. Geçmiş işlemlerini tek tipe indirmek

Şu an iki yaklaşım var:

- **Hareket boyunca topla:** Kalem/silgi, hareket boyunca kayıt toplayıp bitince tek adım yazıyor (`beginGestureHistoryCapture` / `finishGestureHistoryCapture`).
- **Önce snapshot al:** Shape/move, ilk değişiklikten önce snapshot alıp bitince `pushHistorySnapshotOperation` çağırıyor; iptal edilirse eski hâle dönüyor.

İkisini kapsayan tek bir yardımcı düşünülebilir, örneğin:

```ts
const tx = history.begin();      // ilk değişiklikte snapshot alır
tx.touch();                      // değişiklik oldu
tx.commit();                     // değişiklik varsa tek adım yazar
tx.rollback();                   // iptal: eski hâle döner
```

Böylece her araç "boş adım yazma", "iptalde geri dön" mantığını tekrar yazmaz.

## Konuşulacaklar

- Port isimleri ve sınırları (ör. `document` doğrudan `XDrawDataHolder` mı olsun, yoksa araçların kullandığı metotlarla sınırlı bir arayüz mü?)
- 3. adımın gesture-capture (gecikmeli commit, `GESTURE_FINALIZE_DELAY_MS`) ile nasıl birleşeceği
- Hangi adımda testlerin güncelleneceği
