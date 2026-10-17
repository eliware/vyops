import { jest } from "@jest/globals";
import { filesystem, promises } from "./memory-filesystem.mjs";

jest.unstable_mockModule("node:fs", () => filesystem);
jest.unstable_mockModule("node:fs/promises", () => promises);
