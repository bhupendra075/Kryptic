import React from "react";
import "./languageselector.css";

const languages = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "java", label: "Java" },
];

const LanguageSelector = ({ selectedLanguage, onLanguageChange }) => {
  const handleChange = (e) => {
    onLanguageChange(e.target.value);
  };

  return (
    <div className="language-selector">
      <label htmlFor="language-select" className="selector-label">
        Language:
      </label>
      <select
        id="language-select"
        className="language-select"
        value={selectedLanguage}
        onChange={handleChange}
        aria-label="Select programming language"
      >
        {languages.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
