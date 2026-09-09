import justClone from "just-clone"
export function cloneObjectDeep<T extends Object>(obj: T): T {
    // eğer tarayıcıda structuredClone destekleniyorsa onu kullanabiliriz
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }
    // structuredClone desteklenmiyorsa just-clone kütüphanesini kullanabiliriz. en son fallback olarak JSON.parse(JSON.stringify(obj)) kullanıyoruz.
    try {
        return justClone<T>(obj) as T;
    } catch {
        // eğer just-clone yüklenemiyorsa JSON.parse(JSON.stringify(obj)) fallback olarak kullanılır
        return JSON.parse(JSON.stringify(obj));
    }
 
}