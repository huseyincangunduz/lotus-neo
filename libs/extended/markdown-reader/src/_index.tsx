import {
  NeolitComponent,
  state,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);

export interface MarkdownReaderProps {
  markdown: StateOrPlain<string>;
}
export class MarkdownReader extends NeolitComponent<MarkdownReaderProps> {
  private reflectedElement: HTMLElement | null = null;
  private markdownContainer: HTMLDivElement | null = null;

  properties = {
    markdown: state(""),
  };

  onInit() {
    // this.state.markdownContent = "";
    this.properties.markdown.subscribe(async (markdown) => {
      this.updateMd(markdown);
    });

    this.updateMd(this.properties.markdown.get());
  }

  private updateMd(markdown: string) {
    const html = marked(markdown);
    if (html instanceof Promise) {
      html.then((html) => {
        this.renderMarkdownHtml(html);
      });
      return;
    }

    this.renderMarkdownHtml(html);
  }

  private renderMarkdownHtml(html: string) {
    const sanitizedHtml = DOMPurify.sanitize(html);
    const highlightedHtml = this.applyCodeHighlighting(sanitizedHtml);
    this.initializeMarkdownContainer().innerHTML = DOMPurify.sanitize(highlightedHtml);
  }

  private applyCodeHighlighting(html: string) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    const codeElements = wrapper.querySelectorAll("pre code");
    codeElements.forEach((codeElement) => {
      const sourceCode = codeElement.textContent || "";
      const languageClass = Array.from(codeElement.classList).find((name) => name.startsWith("language-"));
      const language = languageClass?.replace("language-", "");

      try {
        const highlighted =
          language && hljs.getLanguage(language)
            ? hljs.highlight(sourceCode, { language, ignoreIllegals: true })
            : hljs.highlightAuto(sourceCode);

        codeElement.innerHTML = highlighted.value;
      } catch {
        codeElement.textContent = sourceCode;
      }

      codeElement.classList.add("hljs");
    });

    return wrapper.innerHTML;
  }

  initializeElement() {
    if (this.reflectedElement) {
      return this.reflectedElement;
    }

    const element = document.createElement("div");
    this.reflectedElement = element;
    return element;
  }

  private initializeMarkdownContainer() {
    if (this.markdownContainer) {
      return this.markdownContainer;
    }

    const hostElement = this.initializeElement();
    const shadowRoot = hostElement.shadowRoot || hostElement.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        color: inherit;
        font-family: inherit;
        line-height: 1.6;
      }

      .markdown-body {
        color: inherit;
        font-size: 1rem;
      }

      .markdown-body h1,
      .markdown-body h2,
      .markdown-body h3,
      .markdown-body h4,
      .markdown-body h5,
      .markdown-body h6 {
        margin: 1.2em 0 0.5em;
        font-weight: 700;
        line-height: 1.25;
      }

      .markdown-body h1 {
        font-size: 2em;
      }

      .markdown-body h2 {
        font-size: 1.5em;
      }

      .markdown-body h3 {
        font-size: 1.25em;
      }

      .markdown-body p {
        margin: 0.8em 0;
      }

      .markdown-body ul,
      .markdown-body ol {
        margin: 0.8em 0;
        padding-inline-start: 1.5rem;
      }

      .markdown-body ul {
        list-style: disc;
      }

      .markdown-body ol {
        list-style: decimal;
      }

      .markdown-body li {
        margin: 0.25em 0;
      }

      .markdown-body a {
        color: inherit;
        text-decoration: underline;
      }

      .markdown-body code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      }

      .markdown-body pre {
        margin: 1em 0;
        padding: 0.9em 1em;
        border-radius: 0.6em;
        border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
        background: color-mix(in srgb, currentColor 7%, transparent);
        overflow: auto;
      }

      .markdown-body pre code {
        display: block;
        background: transparent;
        padding: 0;
      }

      .markdown-body :not(pre) > code {
        border-radius: 0.35em;
        padding: 0.1em 0.35em;
        background: color-mix(in srgb, currentColor 10%, transparent);
      }

      .markdown-body blockquote {
        margin: 1em 0;
        padding: 0.3em 1em;
        border-inline-start: 0.25em solid color-mix(in srgb, currentColor 45%, transparent);
        color: color-mix(in srgb, currentColor 85%, transparent);
      }

      .markdown-body hr {
        border: none;
        border-top: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        margin: 1.5em 0;
      }

      .markdown-body img {
        max-width: 100%;
        height: auto;
        border-radius: 0.5em;
      }

      .markdown-body table {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
        overflow: hidden;
      }

      .markdown-body th,
      .markdown-body td {
        border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
        padding: 0.55em 0.75em;
        text-align: left;
        vertical-align: top;
      }

      .markdown-body th {
        background: color-mix(in srgb, currentColor 10%, transparent);
        font-weight: 700;
      }

      .markdown-body .hljs-comment,
      .markdown-body .hljs-quote {
        color: #6b7280;
      }

      .markdown-body .hljs-keyword,
      .markdown-body .hljs-selector-tag,
      .markdown-body .hljs-subst {
        color: #7c3aed;
        font-weight: 600;
      }

      .markdown-body .hljs-string,
      .markdown-body .hljs-attr,
      .markdown-body .hljs-template-tag {
        color: #0f766e;
      }

      .markdown-body .hljs-number,
      .markdown-body .hljs-literal,
      .markdown-body .hljs-variable,
      .markdown-body .hljs-template-variable {
        color: #b45309;
      }

      .markdown-body .hljs-title,
      .markdown-body .hljs-function,
      .markdown-body .hljs-section {
        color: #1d4ed8;
      }

      .markdown-body .hljs-type,
      .markdown-body .hljs-class .hljs-title {
        color: #be123c;
      }

      .markdown-body .hljs-built_in,
      .markdown-body .hljs-builtin-name,
      .markdown-body .hljs-symbol,
      .markdown-body .hljs-bullet,
      .markdown-body .hljs-link {
        color: #0369a1;
      }

      .markdown-body .hljs-emphasis {
        font-style: italic;
      }

      .markdown-body .hljs-strong {
        font-weight: 700;
      }
    `;

    const container = document.createElement("div");
    container.className = "markdown-body";

    shadowRoot.append(style, container);
    this.markdownContainer = container;
    return container;
  }

  render(): NeolitNode | NeolitNode[] | NeolitComponent | null {
    return this.reflectedElement || this.initializeElement();
  }
}
