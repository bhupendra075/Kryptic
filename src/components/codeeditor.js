import React from "react";
import LanguageSelector from "./languageselector";
import "./codeeditor.css";

const CodeEditor = ({ code, language, onCodeChange, onLanguageChange }) => {
  const handleChange = (e) => {
    onCodeChange(e.target.value);
  };

  return (
    <div className="code-editor">
      <div className="editor-header">
        <h2>Code Editor</h2>
        <LanguageSelector
          selectedLanguage={language}
          onLanguageChange={onLanguageChange}
        />
      </div>
      <div className="editor-controls">
        <label htmlFor="code-input" className="visually-hidden">
          Code Input
        </label>
        <textarea
          id="code-input"
          className="code-input"
          value={code}
          onChange={handleChange}
          placeholder="Paste your code here..."
          spellCheck="false"
          aria-label="Code input area"
        />
      </div>
    </div>
  );
};

export default CodeEditor;
