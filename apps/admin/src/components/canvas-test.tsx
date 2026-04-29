import {
  computed,
  NeolitComponent,
  state,
  type NeolitNode,
} from "@ubs-platform/neolit/core";
import { TextInput } from "@libs/ui/text-input";
import "@libs/extended/uzayduzlem";
import { Uzayduzlem } from "@libs/extended/uzayduzlem";

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
      <div className="h-screen w-screen">
        <Uzayduzlem></Uzayduzlem>
      </div>
    );
  }
}
