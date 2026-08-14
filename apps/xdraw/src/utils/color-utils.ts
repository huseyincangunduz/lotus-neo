export class ColorUtils {
  static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => {
      return r + r + g + g + b + b;
    });

    const regex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
    const result = regex.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  static regularizeToHexColor(color: string): string | null {
    if (color.startsWith("#")) {
      return color;
    } else if (color.startsWith("rgb")) {
      return this.rgbaStringToHex(color);
    } else {
      return null;
    }
  }

  static rgbaStringToHex(rgba: string): string | null {
    const regex = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*\.?\d+))?\s*\)/;
    const result = regex.exec(rgba);
    if (!result) {
      return null;
    }

    const r = parseInt(result[1], 10);
    const g = parseInt(result[2], 10);
    const b = parseInt(result[3], 10);

    return this.rgbToHex(r, g, b);
  }

  static rgbToHex(r: number, g: number, b: number): string {
    return (
      "#" +
      ((1 << 24) + (r << 16) + (g << 8) + b)
        .toString(16)
        .slice(1)
        .toUpperCase()
    );
  }

  static setColorWithAlpha(hexOrRgb: string, alpha: number): string {
    let r: number, g: number, b: number;

    if (hexOrRgb.startsWith("#")) {
      const rgb = this.hexToRgb(hexOrRgb);
      if (!rgb) {
        throw new Error("Invalid hex color");
      }
      r = rgb.r;
      g = rgb.g;
      b = rgb.b;
    } else {
      const rgbMatch = hexOrRgb.match(
        /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*\.?\d+))?\s*\)/
      );
      if (!rgbMatch) {
        throw new Error("Invalid RGB color");
      }
      r = parseInt(rgbMatch[1], 10);
      g = parseInt(rgbMatch[2], 10);
      b = parseInt(rgbMatch[3], 10);
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}