import React from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "./downloadbutton.css";

const DownloadButton = ({
  previewRef,
  isGeneratingPDF,
  setIsGeneratingPDF,
  filename,
}) => {
  const handleDownload = () => {
    if (!previewRef.current || isGeneratingPDF) return;

    setIsGeneratingPDF(true);

    const element = previewRef.current;

    html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    })
      .then((canvas) => {
        const imgData = canvas.toDataURL("image/jpeg", 0.98);
        const pdf = new jsPDF({
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        });
        const imgWidth = 190;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, "JPEG", 10, 10, imgWidth, imgHeight);
        pdf.save(filename);
        setIsGeneratingPDF(false);
      })
      .catch((error) => {
        console.error("Error generating PDF:", error);
        setIsGeneratingPDF(false);
      });
  };

  return (
    <button
      className="download-button"
      onClick={handleDownload}
      disabled={isGeneratingPDF}
      aria-label="Download code as PDF"
    >
      {isGeneratingPDF ? "Generating PDF..." : "Download as PDF"}
    </button>
  );
};

export default DownloadButton;
