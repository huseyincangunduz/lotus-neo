import {
  computed,
  NeolitComponent,
  state,
  type NeolitNode,
} from "@ubs-platform/neolit/core";
import { Trackbar } from "@libs/ui/trackbar";

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
}

interface SceneSettings {
  xRotation: number;
  yRotation: number;
  scale: number;
  centerX: number;
  centerY: number;
}

/**
 * Trigonometrik hesaplarda derece yerine radyan kullanıldığı için, bu yardımcı fonksiyon derece cinsinden verilen bir açıyı radyana çevirir. Radyan, bir dairenin yarıçapına eşit uzunlukta bir yay parçasının merkez açısı olarak tanımlanır ve trigonometrik fonksiyonların doğru çalışması için gereklidir.
 * @param degree Derece cinsinden açı
 * @returns Radyan cinsinden açı
 * 
 * Örneğin, 90 dereceyi radyana çevirmek için bu fonksiyonu kullanırsak, sonuç π/2 (yaklaşık 1.5708) olacaktır, çünkü 90 derece bir çeyrek daireye karşılık gelir ve bir tam daire 2π radyandır.
 */
function toRadians(degree: number): number {
  // Trigonometrik hesaplar radyan ile çalıştığı için dereceyi radyana çeviriyoruz.
  return (degree * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 3D bir noktayı, sahne ayarlarına göre 2D ekrana projeliyor. 
 * Bu fonksiyon, önce verilen 3D noktayı sahnenin x ve y rotasyonlarına göre döndürüyor,
 * ardından basit bir perspektif efekti uygulayarak 2D koordinatlara çeviriyor. 
 * Projeksiyon sırasında, noktanın kameraya olan uzaklığına göre boyutunun küçülmesini 
 * sağlamak için perspektif faktörü kullanılıyor. Sonuç olarak, ekranda doğru konumda ve 
 * boyutta görünmesi sağlanıyor.
 * @param point 3D koordinatları temsil eden nokta
 * @param settings Sahne ayarlarını içeren nesne
 * @returns 2D ekrana projelenmiş nokta
 */
function projectPoint(point: Point3D, settings: SceneSettings): ProjectedPoint {
  // Önce kamera rotasyonlarını radyana çeviriyoruz.
  const xRad = toRadians(settings.xRotation);
  const yRad = toRadians(settings.yRotation);

  // Y ekseni etrafında döndürme: x-z düzlemindeki konum değişir.
  const cosY = Math.cos(yRad);
  const sinY = Math.sin(yRad);
  const rotatedX = point.x * cosY + point.z * sinY;
  const rotatedZ = -point.x * sinY + point.z * cosY;

  // X ekseni etrafında döndürme: y-z düzlemindeki konum değişir.
  const cosX = Math.cos(xRad);
  const sinX = Math.sin(xRad);
  const rotatedY = point.y * cosX - rotatedZ * sinX;
  const finalZ = point.y * sinX + rotatedZ * cosX;

  // Basit perspektif: finalZ arttıkça (uzaklaştıkça) nesne küçülür.
  const perspective = 700 / (700 + finalZ);

  return {
    // 3D noktayı ekran merkezine göre 2D koordinata projeliyoruz.
    x: settings.centerX + rotatedX * settings.scale * perspective,
    y: settings.centerY + rotatedY * settings.scale * perspective,
    // Derinlik değerini (kameraya göre z) ayrıca döndürüp üst katmanlarda kullanıyoruz.
    depth: finalZ,
  };
}

abstract class ModelElement {
  abstract x: number;
  abstract y: number;
  abstract z: number;
  children: ModelElement[] = [];
  parent: ModelElement | null = null;

  addChild(child: ModelElement): void {
    child.parent = this;
    this.children.push(child);
  }

  abstract drawSelf(ctx: CanvasRenderingContext2D, settings: SceneSettings, time: number): void;

  draw(ctx: CanvasRenderingContext2D, settings: SceneSettings, time: number): void {
    this.drawSelf(ctx, settings, time);
    this.children.forEach((child) => child.draw(ctx, settings, time));
  }
}

class ChibiHead extends ModelElement {
  x = 0;
  y = 0;
  z = 0;
  width = 180;
  height = 170;

  constructor() {
    super();
    this.addChild(new ChibiEye(-1));
    this.addChild(new ChibiEye(1));
  }

  getFaceMetrics(settings: SceneSettings, time: number): {
    center: ProjectedPoint;
    bob: number;
    faceWidth: number;
    faceHeight: number;
  } {
    // Idle animasyon için sinüs tabanlı hafif yukarı-aşağı hareket.
    const bob = Math.sin(time * 0.002) * 6;
    const center = projectPoint({ x: this.x, y: this.y + bob, z: this.z }, settings);

    // Yüzün ekrandaki ölçeğini depth'e göre hafifçe ayarlıyoruz.
    const depthScale = Math.max(0.7, Math.min(1.3, 1 - center.depth / 1200));
    const baseW = this.width * settings.scale * depthScale;
    const baseH = this.height * settings.scale * depthScale;

    return {
      center,
      bob,
      faceWidth: baseW,
      faceHeight: baseH,
    };
  }

  drawSelf(ctx: CanvasRenderingContext2D, settings: SceneSettings, time: number): void {
    const { center, faceWidth, faceHeight } = this.getFaceMetrics(settings, time);


    ctx.beginPath();
    ctx.ellipse(center.x, center.y, faceWidth * 0.48, faceHeight * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e6c79b";
    ctx.fill();

  }
}

class ChibiEye extends ModelElement {
  x = 0;
  y = 0;
  z = 20;
  side: -1 | 1;

  constructor(side: -1 | 1) {
    super();
    this.side = side;
  }

  drawSelf(ctx: CanvasRenderingContext2D, settings: SceneSettings, time: number): void {
    const head = this.parent;
    if (!(head instanceof ChibiHead)) {
      return;
    }

    const { center, faceWidth, faceHeight } = head.getFaceMetrics(settings, time);
    // Eşik altına düşünce göz yüksekliğini küçültüp kırpma efekti veriyoruz.
    const eyeOpenFactor = Math.abs(Math.sin(time * 0.006)) < 0.09 ? 0.14 : 1;

    // -90..90 aralığını -1..1'e çekiyoruz. Mutlak değer profil dönüş miktarını verir.
    const normalizedY = clamp(settings.yRotation / 90, -1, 1);
    const turnAmount = Math.abs(normalizedY);

    // Kameraya bakan taraf: pozitif dönüşte sağ göz, negatif dönüşte sol göz.
    const facingSide: -1 | 1 = normalizedY >= 0 ? 1 : -1;
    const isFacingEye = this.side === facingSide;

    // İçte kalan göz dönüş arttıkça küçülür ve profile gelince tamamen kaybolur.
    const visibilityScale = isFacingEye ? 1 : 1 - turnAmount;
    if (visibilityScale <= 0.01) {
      return;
    }

    // Kameraya bakan göz, profil açıya yaklaştıkça kafa kenarına doğru kayar.
    const normalOffset = 0.18;
    const edgeOffset = 0.44;
    const hiddenEyeOffset = 0.18;
    const eyeOffsetRatio = isFacingEye
      ? normalOffset + (edgeOffset - normalOffset) * turnAmount
      : hiddenEyeOffset * (1 - turnAmount * 0.65);

    const eyeCenterX = center.x + this.side * faceWidth * eyeOffsetRatio;
    const eyeCenterY = center.y - faceHeight * 0.05;

    const eyeWidth = faceWidth * 0.075 * visibilityScale;
    // Göz açık/kapalı hissi dikey yarıçap üzerinden kontrol ediliyor.
    const eyeHeight = faceHeight * 0.09 * eyeOpenFactor * Math.max(0.15, visibilityScale);

    ctx.beginPath();
    ctx.ellipse(eyeCenterX, eyeCenterY, Math.max(1.5, eyeWidth), Math.max(1.5, eyeHeight), 0, 0, Math.PI * 2);
    ctx.fillStyle = "#25170d";
    ctx.fill();
  }
}
// Modeli görüntülemek için basit bir sahne ayarları arayüzü oluşturuyoruz. Bu ayarlar, modelin nasıl döndürüleceği ve ölçekleneceği gibi bilgileri içeriyor.
export class Test2 extends NeolitComponent {
  canvasElement: HTMLCanvasElement | null = null;
  animationFrameId: number | null = null;
  modelRoot = new ChibiHead();

  yRotation = state<number>(0);
  xRotation = state<number>(0);
  scale = state<number>(1);

  allComputed = computed([this.yRotation, this.xRotation, this.scale], () => {
    this.updateViews();
  });

  onInit(): void {
    this.updateViews();
    this.startAnimation();
  }

  onDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = null;
  }

  startAnimation() {
    const animate = () => {
      this.updateViews(performance.now());
      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  updateViews(time: number = performance.now()) {
    if (!this.canvasElement) {
      this.canvasElement = document.createElement("canvas");
      this.canvasElement.width = 600;
      this.canvasElement.height = 600;
    }

    const context = this.canvasElement.getContext("2d");

    if (context) {
      context.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

      // Sahneye hoş bir degrade arka plan ekleyelim.
      const gradient = context.createLinearGradient(0, 0, 0, this.canvasElement.height);
      gradient.addColorStop(0, "#f6f4ea");
      gradient.addColorStop(1, "#e8efe7");
      context.fillStyle = gradient;
      context.fillRect(0, 0, this.canvasElement.width, this.canvasElement.height);

      // Modeli sahne ayarlarıyla çiziyoruz. Ayarlar, kullanıcı tarafından kontrol edilen rotasyon ve ölçek değerlerini içeriyor.
      this.modelRoot.draw(
        context,
        {
          xRotation: this.xRotation.get(),
          yRotation: this.yRotation.get(),
          scale: this.scale.get(),
          centerX: this.canvasElement.width / 2,
          centerY: this.canvasElement.height / 2,
        },
        time,
      );
    }
  }

  render(): NeolitNode {
    return (
      <div className="h-screen w-screen">
        <div className="flex h-full w-full gap-4 p-4">
          <div>
            <Trackbar label={"Yatay rotasyon"} min={-90} max={90} step={1} value={this.yRotation}></Trackbar>
            <Trackbar label={"Dikey rotasyon"} min={-90} max={90} step={1} value={this.xRotation}></Trackbar>
            <Trackbar label={"Ölçekleme"} min={0.6} max={2.2} step={0.1} value={this.scale}></Trackbar>
          </div>
          <div className="flex-grow-1 canvas-holder">
            {this.canvasElement}
          </div>
        </div>
      </div>
    );
  }
}
