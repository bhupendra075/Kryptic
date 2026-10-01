import React from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { prism } from "react-syntax-highlighter/dist/cjs/styles/prism";
import javascript from "react-syntax-highlighter/dist/cjs/languages/hljs/javascript";
import python from "react-syntax-highlighter/dist/cjs/languages/hljs/python";
import java from "react-syntax-highlighter/dist/cjs/languages/hljs/java";
import csharp from "react-syntax-highlighter/dist/cjs/languages/hljs/csharp";
import cpp from "react-syntax-highlighter/dist/cjs/languages/hljs/cpp";
import c from "react-syntax-highlighter/dist/cjs/languages/hljs/c";
import html from "react-syntax-highlighter/dist/cjs/languages/hljs/xml";
import css from "react-syntax-highlighter/dist/cjs/languages/hljs/css";
import sql from "react-syntax-highlighter/dist/cjs/languages/hljs/sql";
import json from "react-syntax-highlighter/dist/cjs/languages/hljs/json";
import "./codepreview.css";

SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("csharp", csharp);
SyntaxHighlighter.registerLanguage("cpp", cpp);
SyntaxHighlighter.registerLanguage("c", c);
SyntaxHighlighter.registerLanguage("html", html);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("json", json);

const CodePreview = ({ code, language }) => {
  return (
    <div className="code-preview">
      <SyntaxHighlighter
        language={language}
        style={prism}
        showLineNumbers={true}
        wrapLines={true}
        lineNumberStyle={{
          color: "#999",
          fontSize: "0.9rem",
        }}
        customStyle={{
          fontSize: "0.9rem",
          backgroundColor: "transparent",
          padding: "0",
          margin: "0",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodePreview;
