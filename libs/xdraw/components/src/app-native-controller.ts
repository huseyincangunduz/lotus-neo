import type { State } from "@ubs-platform/neolit/core";

export const APP_NATIVE_CONTROLLER_TOKEN = Symbol("APP_NATIVE_CONTROLLER_TOKEN");

export interface IAppNativeMenuItem {
    label: string;
    icon?: string;
    onClick(): void | Promise<void>;
}

export interface IAppNativeSaveOptions {
    /**
     * Kayit basarili olursa cagrilir ve projenin kucuk bir onizleme gorselini uretir.
     * Kayit iptal edilirse/basarisiz olursa hic cagrilmamalidir (bosuna render yapilmasin).
     */
    thumbnailFactory?: () => Promise<Blob | null>;
}

export interface IRecentFileEntry {
    /** Platforma ozgu benzersiz anahtar (mobilde content:// URI). */
    id: string;
    fileName: string;
    /** Son kaydedilme/acilma zamani (epoch ms). Eski kayitlarda olmayabilir. */
    savedAt?: number;
}

export interface IRecentFilesProvider {
    list: State<IRecentFileEntry[]>;
    /** Dosyayi acar; acilan dosya onExternalFileOpened callback'leri uzerinden iletilir. */
    open(id: string): Promise<void>;
    remove(id: string): Promise<void>;
    getThumbnail(id: string): Promise<Blob | undefined>;
}

export interface IAppNativeController {
    isMobileApp: boolean;
    isBrowserWebApp: boolean;
    isElectronApp: boolean;
    appName?: string;
    extraMenuItems?: State<IAppNativeMenuItem[]>;
    /** Destekleyen platformlarda son dosyalar (gecmis) listesi. */
    recentFiles?: IRecentFilesProvider;

    /**
     * 
     * @param data Verilen veriyi Blob olarak alır ve dosya olarak indirilmesini sağlar. Eğer fileNameOrPath parametresi verilmezse, tarayıcı varsayılan olarak "download" ismini kullanır.
     * @param fileNameOrPath Dosya pathi veya dosya ismi. Uygulama içinde verilmezse 'farklı kaydet' diyaloğu gösterilebilir. Tarayıcıda ise varsayılan olarak "download" ismi kullanılır.
     * @param options Proje kayitlarinda onizleme gorseli gibi ek bilgiler.
     * @returns void
     * 
     * @example
     * // Örnek kullanım:
     * const data = new Blob(["Hello, world!"], { type: "text/plain" });
     * appNativeController.downloadDataRequest(data, "hello.txt");
     * 
     * // Eğer fileNameOrPath parametresi verilmezse:
     * appNativeController.downloadDataRequest(data);
     * // Tarayıcı varsayılan olarak "download" ismini kullanır.
     */
    downloadDataRequest(data: Blob, saveMimetype: string, fileNameOrPath?: string, options?: IAppNativeSaveOptions): void | Promise<void>;
    openFileRequest(mimeType: string): File | Promise<File | null>;

    /**
     * Aktif proje artik onceki acilan/kaydedilen dosyayla iliskili degilse
     * platformun tuttugu dosya hedefini temizler.
     */
    clearActiveFileTarget?(): void;

    /**
     * Verilen veriyi paylaşma menüsü (share sheet) üzerinden paylaşır.
     * Desteklenmeyen platformlarda tanımsız (undefined) bırakılabilir.
     */
    shareDataRequest?(data: Blob, mimeType: string, fileName: string): void | Promise<void>;

    /**
     * Uygulama Explorer üzerinden "birlikte aç" (open with) ile soğuk başlatıldıysa
     * bekleyen dosyayı döner ve tüketir. Yoksa null döner.
     */
    checkPendingExternalFile?(): Promise<File | null>;

    /**
     * Uygulama zaten açıkken Explorer üzerinden "birlikte aç" ile yeni bir dosya
     * açılmaya çalışılırsa tetiklenir.
     */
    onExternalFileOpened?(callback: (file: File) => void): void;
}