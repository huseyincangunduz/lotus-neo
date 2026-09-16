export class ColorUtils {
  static hexToHsl(hex: string): { h: number; s: number; l: number } | null {
    const rgb = this.hexToRgb(hex);
    if (!rgb) {
      return null;
    }

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;

    if (max === min) {
      return { h: 0, s: 0, l: lightness * 100 };
    }

    const delta = max - min;
    const saturation =
      lightness > 0.5
        ? delta / (2 - max - min)
        : delta / (max + min);
    let hue: number;

    switch (max) {
      case r:
        hue = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      default:
        hue = (r - g) / delta + 4;
        break;
    }

    return {
      h: (hue / 6) * 360,
      s: saturation * 100,
      l: lightness * 100,
    };
  }

  static hslToHex(hue: number, saturation: number, lightness: number): string {
    const h = (((hue % 360) + 360) % 360) / 360;
    const s = Math.max(0, Math.min(100, saturation)) / 100;
    const l = Math.max(0, Math.min(100, lightness)) / 100;

    if (s === 0) {
      const channel = Math.round(l * 255);
      return this.rgbToHex(channel, channel, channel);
    }

    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const second = chroma * (1 - Math.abs(((h * 6) % 2) - 1));
    const match = l - chroma / 2;
    const sector = Math.floor(h * 6);
    const channels = [
      [chroma, second, 0],
      [second, chroma, 0],
      [0, chroma, second],
      [0, second, chroma],
      [second, 0, chroma],
      [chroma, 0, second],
    ][sector] ?? [0, 0, 0];

    return this.rgbToHex(
      Math.round((channels[0] + match) * 255),
      Math.round((channels[1] + match) * 255),
      Math.round((channels[2] + match) * 255),
    );
  }

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