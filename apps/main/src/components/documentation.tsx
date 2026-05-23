import { DownloadWarning, IntroDownloads } from "@libs/extended/introductions";
import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";
import { MarkdownReader } from "@libs/extended/markdown-reader";
const mdTemplateTest = `
# Test
## Test 2
- Test 1
- Test 2
\`\`\`javascript
console.log("Hello, world!");
\`\`\`
`
export class Documentation extends NeolitComponent {
  render(): NeolitNode {
    return (
      <>
        <MarkdownReader
          markdown={mdTemplateTest}
        ></MarkdownReader>
      </>
    );
  }
}
