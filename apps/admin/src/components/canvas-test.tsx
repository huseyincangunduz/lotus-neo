import {
  computed,
  NeolitComponent,
  state,
  type NeolitNode,
} from "@ubs-platform/neolit/core";
import { TextInput } from "@libs/ui/text-input";

export class CanvasTest extends NeolitComponent {
  viewBoxX = state("0");
  viewBoxY = state("0");
  viewBoxWidth = state("2000");
  viewBoxHeight = state("200");
  viewBox = computed(
    [this.viewBoxX, this.viewBoxY, this.viewBoxWidth, this.viewBoxHeight],
    ([x, y, width, height]) => `${x} ${y} ${width} ${height}`,
  );

  render(): NeolitNode {
    return (
      <div className="h-screen w-screen p-2 flex flex-col gap-1">
        <div className="h-[50px] w-full bg-blue-500 flex items-center gap-1 px-2">
          <TextInput placeholder="X" value={this.viewBoxX} type={"number"}></TextInput>
          <TextInput placeholder="Y" value={this.viewBoxY} type={"number"}></TextInput>
          <TextInput placeholder="Width" value={this.viewBoxWidth} type={"number"}></TextInput>
          <TextInput placeholder="Height" value={this.viewBoxHeight} type={"number"}></TextInput>
        </div>
        <div className="flex-grow overflow-hidden">
          <svg
            height="100%"
            width="100%"
            viewBox={this.viewBox}
            xmlns="http://www.w3.org/2000/svg"
          >
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
          </svg>
        </div>
        {/* Canvas bileşeni burada kullanılabilir */}
      </div>
    );
  }
}
