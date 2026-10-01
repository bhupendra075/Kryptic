import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
jest.mock("./semanticClient", () => ({ createSemanticWorker: jest.fn() }));
const App = require("./App").default;

test("shows vault creation on first visit", async () => {
  render(<App />);
  expect(screen.getByText("Kryptic")).toBeInTheDocument();
  expect(screen.getByLabelText("Create a vault password")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Local storage is unavailable"));
});
