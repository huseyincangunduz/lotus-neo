export const asset = (path: string): string => {
    const baseDestructed = import.meta.env.BASE_URL?.split("/").filter(Boolean) ?? [];
    return [...baseDestructed, path].join("/");

}
//   `${import.meta.env.BASE_URL}${path}`;
