import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.crypto = { randomUUID: () => `test-${Math.random()}` };

const mockStored = new Map();
jest.mock("./semanticClient", () => ({ createSemanticWorker: jest.fn() }));
jest.mock("./semantic", () => ({ supportsSemanticSearch: jest.fn() }));
jest.mock("./vault", () => ({
  openVaultDb: jest.fn(),
  hasVault: jest.fn(),
  createVault: jest.fn(),
  loadItems: jest.fn(),
  saveItem: jest.fn(),
  deleteItem: jest.fn(),
  changeVaultPassword: jest.fn(),
  createEncryptedBackup: jest.fn(),
  restoreEncryptedBackup: jest.fn(),
  unlockVault: jest.fn(),
}));

const App = require("./App").default;
const vault = require("./vault");
const { createSemanticWorker } = require("./semanticClient");
const { supportsSemanticSearch } = require("./semantic");

function prepareVault() {
  mockStored.clear();
  vault.openVaultDb.mockResolvedValue({});
  vault.hasVault.mockResolvedValue(false);
  vault.createVault.mockResolvedValue({});
  vault.loadItems.mockResolvedValue([]);
  vault.saveItem.mockImplementation(async (_db, _key, item) => { mockStored.set(item.id, item); });
}

async function createTestVault() {
  fireEvent.change(screen.getByLabelText("Create a vault password"), { target: { value: "test-password-123" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Create vault" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Create vault" }));
  await screen.findByRole("button", { name: "+ Note" });
}

test("filters, command palette, and revision restore work together", async () => {
  prepareVault();
  supportsSemanticSearch.mockReturnValue(false);
  render(<App />);
  await createTestVault();

  fireEvent.click(screen.getByRole("button", { name: "+ Note" }));
  fireEvent.change(screen.getByLabelText("Entry title"), { target: { value: "Release plan" } });
  fireEvent.change(screen.getByLabelText("Entry content"), { target: { value: "First draft" } });
  fireEvent.change(screen.getByLabelText("Entry tags"), { target: { value: "work" } });
  fireEvent.blur(screen.getByLabelText("Entry tags"));
  fireEvent.click(screen.getByRole("button", { name: "Add favorite" }));
  fireEvent.change(screen.getByLabelText("Search entries"), { target: { value: "release tag:work type:note is:favorite" } });
  expect(screen.getByRole("button", { name: /Release plan/ })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search entries"), { target: { value: "tag:missing" } });
  expect(screen.queryByRole("button", { name: /Release plan/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search entries"), { target: { value: "" } });

  fireEvent.keyDown(document, { key: "k", ctrlKey: true });
  const palette = screen.getByRole("dialog", { name: "Command palette" });
  fireEvent.change(within(palette).getByLabelText("Find a command"), { target: { value: "go to favorites" } });
  fireEvent.keyDown(within(palette).getByLabelText("Find a command"), { key: "Enter" });
  expect(screen.getByRole("heading", { name: "Favorites" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Release plan/ }));

  fireEvent.click(screen.getByRole("button", { name: "Save version" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText("Entry content"), { target: { value: "Second draft" } });
  window.confirm = jest.fn(() => true);
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  await waitFor(() => expect(screen.getByLabelText("Entry content")).toHaveValue("First draft"));
  await waitFor(() => expect([...mockStored.values()][0].body).toBe("First draft"));
});

test("clearing a semantic query ignores late results", async () => {
  prepareVault();
  supportsSemanticSearch.mockReturnValue(true);
  const worker = { postMessage: jest.fn(), terminate: jest.fn(), onmessage: null };
  createSemanticWorker.mockReturnValue(worker);
  render(<App />);
  await createTestVault();
  fireEvent.click(screen.getByRole("button", { name: "+ Note" }));
  fireEvent.change(screen.getByLabelText("Entry title"), { target: { value: "Visible note" } });
  fireEvent.click(screen.getByRole("button", { name: "Semantic search" }));
  fireEvent.change(screen.getByLabelText("Search entries"), { target: { value: "related" } });
  await waitFor(() => expect(worker.postMessage).toHaveBeenCalled(), { timeout: 1500 });
  const requestId = worker.postMessage.mock.calls[0][0].requestId;
  fireEvent.change(screen.getByLabelText("Search entries"), { target: { value: "" } });
  worker.onmessage({ data: { type: "results", requestId, ids: [] } });
  expect(screen.getByRole("button", { name: /Visible note/ })).toBeInTheDocument();
});
