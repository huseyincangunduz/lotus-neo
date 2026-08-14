export const APP_NATIVE_CONTROLLER_TOKEN = Symbol("APP_NATIVE_CONTROLLER_TOKEN");


export interface IAppNativeController {
    isMobileApp: boolean;
    isBrowserWebApp: boolean;
    isElectronApp: boolean;

    /**
     * 
     * @param data Verilen veriyi Blob olarak alır ve dosya olarak indirilmesini sağlar. Eğer fileNameOrPath parametresi verilmezse, tarayıcı varsayılan olarak "download" ismini kullanır.
     * @param fileNameOrPath Dosya pathi veya dosya ismi. Uygulama içinde verilmezse 'farklı kaydet' diyaloğu gösterilebilir. Tarayıcıda ise varsayılan olarak "download" ismi kullanılır.
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
    downloadDataRequest(data: Blob, saveMimetype: string, fileNameOrPath?: string): void | Promise<void>;
    openFileRequest(mimeType: string): File | Promise<File | null>;

}