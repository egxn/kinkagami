import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { readEmbeddedData } from "./embeddedData";

const EMBEDDED_PKG = path.resolve(__dirname, "../../embedded/package.json");
const tmpDirs: string[] = [];

const makeRoot = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kgm-embedded-"));
  tmpDirs.push(dir);
  return dir;
};

const writeJson = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
};

afterEach(() => {
  while (tmpDirs.length)
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe("readEmbeddedData", () => {
  it("returns empty data when embedded has nothing", async () => {
    const out = await readEmbeddedData(makeRoot(), {
      modulesFrom: EMBEDDED_PKG,
    });
    expect(out.exercises).toEqual([]);
    expect(out.routines).toEqual([]);
    expect(out.sources).toEqual({ seedFiles: 0, leveldbDocs: 0 });
  });

  it("reads seed files (single docs and arrays), skipping malformed ones", async () => {
    const root = makeRoot();
    writeJson(path.join(root, "src/db/exercises/a.json"), {
      _id: "a",
      name: "A",
    });
    writeJson(path.join(root, "src/db/exercises/b.json"), [
      { exercise_id: "b" },
      { _id: "c" },
    ]);
    fs.writeFileSync(path.join(root, "src/db/exercises/bad.json"), "{nope");
    writeJson(path.join(root, "src/db/routines/r.json"), {
      _id: "r",
      name: "R",
      exercises: ["a"],
    });

    const out = await readEmbeddedData(root, { modulesFrom: EMBEDDED_PKG });
    expect(out.exercises.map((d) => d._id ?? d.exercise_id).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(out.routines).toHaveLength(1);
    expect(out.sources.seedFiles).toBe(4);
  });

  it("reads a real LevelDB snapshot and lets seed files override it by id", async () => {
    const root = makeRoot();
    const req = createRequire(EMBEDDED_PKG);
    const PouchDB = req("pouchdb");
    const leveldown = req("leveldown");

    const db = new PouchDB(path.join(root, "exercises"), {
      adapter: "leveldb",
      db: leveldown,
    });
    await db.put({ _id: "x", name: "from-db" });
    await db.put({ _id: "y", name: "only-db" });
    await db.close();
    writeJson(path.join(root, "src/db/exercises/x.json"), {
      _id: "x",
      name: "from-seed",
    });

    const out = await readEmbeddedData(root, { modulesFrom: EMBEDDED_PKG });
    expect(out.sources.leveldbError).toBeUndefined();
    expect(out.sources.leveldbDocs).toBe(2);
    const byId = Object.fromEntries(
      out.exercises.map((d) => [d._id as string, d.name]),
    );
    expect(byId).toEqual({ x: "from-seed", y: "only-db" });
    expect(out.exercises.every((d) => !("_rev" in d))).toBe(true);
  });

  it("degrades gracefully when LevelDB modules are unavailable", async () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, "exercises"), { recursive: true });
    fs.writeFileSync(path.join(root, "exercises/CURRENT"), "MANIFEST-000001\n");
    writeJson(path.join(root, "src/db/exercises/a.json"), { _id: "a" });

    const out = await readEmbeddedData(root, {
      modulesFrom: path.join(root, "package.json"),
    });
    expect(out.exercises).toHaveLength(1);
    expect(out.sources.leveldbError).toBeTruthy();
  });
});
