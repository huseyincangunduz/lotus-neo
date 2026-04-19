# lotus-neo

[Neolit](https://github.com/ubs-platform/neolit) tabanlı, birden fazla frontend uygulamasını ve paylaşılan kütüphaneleri tek repo altında yönetmek için Vite monorepo yapısı.

## Proje Yapısı

```
lotus-neo/
├── apps/
│   ├── admin/          # Admin uygulaması
│   └── main/           # Ana uygulama
├── libs/
│   ├── ui/
│   │   └── button/     # Button bileşen kütüphanesi
│   └── keltos-kel/     # Başka bir paylaşılan kütüphane
├── libs-map.js         # @libs/* alias'larını otomatik keşfeder
├── vite-config-global.js
└── tsconfig.json
```

## Uygulama Çalıştırma ve Build Alma

Tüm komutlar monoreponun **kök dizininden** çalıştırılır.

```bash
# Geliştirme sunucusunu başlatma
npm run dev admin
npm run dev main

# Production build alma
npm run build admin
npm run build main

# Production build önizleme
npm run preview admin
npm run preview main
```

> Script'ler `$1` parametresiyle uygulama adını alır; her zaman `apps/` altındaki klasör adını argüman olarak geçin.

## Yeni Kütüphane Oluşturma

1. `libs/` altında klasör oluşturun, örn. `libs/my-lib/src/`.
2. `libs/my-lib/src/index.ts` dosyasını giriş noktası olarak ekleyin:
   ```ts
   export * from "./_index";
   ```
3. Bileşen veya modül dosyasını oluşturun, örn. `libs/my-lib/src/_index.tsx`.
4. Hepsi bu — `libs-map.js` kütüphaneyi otomatik keşfeder ve `@libs/my-lib` alias'ına bağlar.

> **İç içe kütüphaneler** de desteklenir. Örneğin `libs/ui/button/src/index.ts` dosyası `@libs/ui/button` olarak eşlenir. Keşif özyinelemeli çalışır.

### Kütüphaneyi Uygulamada Kullanma

```tsx
import { Button } from "@libs/ui/button";
import { KeltosKel } from "@libs/keltos-kel";
```

TypeScript'in çözümleyebilmesi için kök `tsconfig.json` içinde path alias zaten wildcard ile tanımlanmıştır:

```json
"paths": {
  "@libs/*": ["./libs/*/src/index.ts"]
}
```

> Yeni kütüphaneler bu wildcard sayesinde otomatik olarak TypeScript tarafından da tanınır.

## Neolit Kullanımı

[Neolit](https://github.com/ubs-platform/neolit), bu monoreponun dayandığı UI framework'üdür. Bileşenler `NeolitComponent`'i genişletir ve `render()` metodundan JSX döner.

### Temel Bileşen

```tsx
import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";

export class MyComponent extends NeolitComponent {
  render(): NeolitNode | null {
    return <div>Neolit'ten merhaba!</div>;
  }
}
```

### Props'lu Bileşen

```tsx
export interface MyProps {
  title: string;
}

export class MyComponent extends NeolitComponent {
  title: string;

  constructor({ title }: MyProps) {
    super();
    this.title = title;
  }

  render(): NeolitNode | null {
    return <h1>{this.title}</h1>;
  }
}
```

### JSX Yapılandırması

Neolit'in JSX factory'si `vite-config-global.js` ve `tsconfig.json` üzerinden global olarak yapılandırılmıştır. Dosya başına pragma eklemenize gerek yoktur:

```json
// tsconfig.json
"jsx": "react-jsx",
"jsxImportSource": "@ubs-platform/neolit"
```

### Neolit Güncelleme

```bash
npm install @ubs-platform/neolit@latest
```

Güncellemeden önce breaking change olup olmadığını kontrol etmek için [Neolit deposuna](https://github.com/ubs-platform/neolit) bakın.
