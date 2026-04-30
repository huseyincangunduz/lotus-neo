import {
  computed,
  NeolitComponent,
  state,
  type NeolitNode,
} from "@ubs-platform/neolit/core";
import { TextInput } from "@libs/ui/text-input";

export class Uzayduzlem extends NeolitComponent {
  viewBoxX = state("0");
  viewBoxY = state("0");
  viewBoxWidth = state("2000");
  viewBoxHeight = state("200");
  viewBox = computed(
    [this.viewBoxX, this.viewBoxY, this.viewBoxWidth, this.viewBoxHeight],
    ([x, y, width, height]) => `${x} ${y} ${width} ${height}`,
  );

  private _lastTouchX = 0;
  private _lastTouchY = 0;
  private _lastPinchDist = 0;
  private _isPinching = false;

  private _dist(t1: Touch, t2: Touch): number {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }

  private _onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      this._lastTouchX = e.touches[0].clientX;
      this._lastTouchY = e.touches[0].clientY;
      this._isPinching = false;
    } else if (e.touches.length === 2) {
      this._lastPinchDist = this._dist(e.touches[0], e.touches[1]);
      this._isPinching = true;
    }
  };

  private _onTouchMove = (e: TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    if (e.touches.length === 1 && !this._isPinching) {
      const dx = e.touches[0].clientX - this._lastTouchX;
      const dy = e.touches[0].clientY - this._lastTouchY;
      this._lastTouchX = e.touches[0].clientX;
      this._lastTouchY = e.touches[0].clientY;

      const scaleX = parseFloat(this.viewBoxWidth.get()) / rect.width;
      const scaleY = parseFloat(this.viewBoxHeight.get()) / rect.height;
      this.viewBoxX.set(String(parseFloat(this.viewBoxX.get()) - dx * scaleX));
      this.viewBoxY.set(String(parseFloat(this.viewBoxY.get()) - dy * scaleY));
    } else if (e.touches.length === 2) {
      const newDist = this._dist(e.touches[0], e.touches[1]);
      const scale = this._lastPinchDist / newDist;
      this._lastPinchDist = newDist;

      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const vbX = parseFloat(this.viewBoxX.get());
      const vbY = parseFloat(this.viewBoxY.get());
      const vbW = parseFloat(this.viewBoxWidth.get());
      const vbH = parseFloat(this.viewBoxHeight.get());

      // Pinch merkezini viewBox koordinatlarına çevir
      const pcX = vbX + ((cx - rect.left) / rect.width) * vbW;
      const pcY = vbY + ((cy - rect.top) / rect.height) * vbH;

      const newW = vbW * scale;
      const newH = vbH * scale;

      // Pinch merkezi sabit kalsın
      this.viewBoxX.set(String(pcX - ((cx - rect.left) / rect.width) * newW));
      this.viewBoxY.set(String(pcY - ((cy - rect.top) / rect.height) * newH));
      this.viewBoxWidth.set(String(newW));
      this.viewBoxHeight.set(String(newH));
    }
  };

  private _onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) this._isPinching = false;
    if (e.touches.length === 1) {
      this._lastTouchX = e.touches[0].clientX;
      this._lastTouchY = e.touches[0].clientY;
    }
  };

  private _onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    const vbX = parseFloat(this.viewBoxX.get());
    const vbY = parseFloat(this.viewBoxY.get());
    const vbW = parseFloat(this.viewBoxWidth.get());
    const vbH = parseFloat(this.viewBoxHeight.get());

    if (e.ctrlKey) {
      // Pinch zoom (touchpad)
      const scale = 1 + e.deltaY * 0.01;
      const pcX = vbX + ((e.clientX - rect.left) / rect.width) * vbW;
      const pcY = vbY + ((e.clientY - rect.top) / rect.height) * vbH;
      const newW = vbW * scale;
      const newH = vbH * scale;
      this.viewBoxX.set(
        String(pcX - ((e.clientX - rect.left) / rect.width) * newW),
      );
      this.viewBoxY.set(
        String(pcY - ((e.clientY - rect.top) / rect.height) * newH),
      );
      this.viewBoxWidth.set(String(newW));
      this.viewBoxHeight.set(String(newH));
    } else {
      // İki parmak kaydırma (pan)
      const scaleX = vbW / rect.width;
      const scaleY = vbH / rect.height;
      this.viewBoxX.set(String(vbX + e.deltaX * scaleX));
      this.viewBoxY.set(String(vbY + e.deltaY * scaleY));
    }
  };

  render(): NeolitNode {
    return (
      <div className="h-full w-full p-2 flex flex-col gap-1">
        <div className="h-[50px] w-full bg-blue-500 flex items-center gap-1 px-2">
          <TextInput
            label="X"
            value={this.viewBoxX}
            type={"number"}
          ></TextInput>
          <TextInput
            label="Y"
            value={this.viewBoxY}
            type={"number"}
          ></TextInput>
          <TextInput
            label="Width"
            value={this.viewBoxWidth}
            type={"number"}
          ></TextInput>
          <TextInput
            label="Height"
            value={this.viewBoxHeight}
            type={"number"}
          ></TextInput>
        </div>
        <div
          className="flex-grow overflow-hidden touch-none"
          onTouchstart={this._onTouchStart}
          onTouchmove={this._onTouchMove}
          onTouchend={this._onTouchEnd}
          onTouchcancel={this._onTouchEnd}
          onWheel={this._onWheel}
        >
          <svg
            height="100%"
            width="100%"
            viewBox={this.viewBox}
            xmlns="http://www.w3.org/2000/svg"
          >
            <g id="ana-grup">
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="lightblue"
                stroke="blue"
                stroke-width="4"
              />
              <line
                x1="100"
                y1="100"
                x2="150"
                y2="50"
                stroke="red"
                stroke-width="4"
              />
              <line
                x1="100"
                y1="100"
                x2="50"
                y2="50"
                stroke="green"
                stroke-width="4"
              />
            </g>
          </svg>
        </div>
        {/* Canvas bileşeni burada kullanılabilir */}
      </div>
    );
  }
}
