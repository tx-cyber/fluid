import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  chunkSupportDocument,
  selectRelevantSupportChunks,
} from "./shared";

const SUPPORT_DOCS = [
  { title: "Fluid Repository Overview", relativePath: "README.md" },
  { title: "Fluid Server Overview", relativePath: "server/README.md" },
  { title: "Fluid Server Quick Start", relativePath: "server/QUICK_START.md" },
  { title: "Admin Dashboard Overview", relativePath: "admin-dashboard/README.md" },
];

function getRepoRoot() {
  return path.resolve(process.cwd(), "..");
}

async function loadDocument(title: string, relativePath: string) {
  const absolutePath = path.join(getRepoRoot(), relativePath);
  const content = await readFile(absolutePath, "utf8");
  return chunkSupportDocument({
    title,
    source: relativePath,
    content,
  });
}

export async function getRelevantSupportDocs(query: string) {
  const chunkLists = await Promise.all(
    SUPPORT_DOCS.map((document) =>
      loadDocument(document.title, document.relativePath).catch(() => []),
    ),
  );

  return selectRelevantSupportChunks(query, chunkLists.flat(), 4);
}
