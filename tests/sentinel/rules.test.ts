import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { loadRules } from "../../src/lib/rules.js";

let tmpDir: string;

function tmpFile(content: string): string {
  if (!tmpDir) {
    tmpDir = join(tmpdir(), `sentinel-rules-test-${randomUUID()}`);
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  }
  const fp = join(tmpDir, `rules-${randomUUID()}.json`);
  writeFileSync(fp, content, "utf-8");
  return fp;
}

describe("loadRules", () => {
  it("loads a valid rules file", () => {
    const fp = tmpFile(JSON.stringify({
      rules: [
        {
          id: "test-rule",
          type: "move_event",
          params: { package: "0x2", module: "test" },
          notify: ["stdout"],
        },
      ],
    }));
    const config = loadRules(fp);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].id).toBe("test-rule");
    expect(config.rules[0].type).toBe("move_event");
  });

  it("throws for missing file", () => {
    expect(() => loadRules("/nonexistent/file.json")).toThrow("not found");
  });

  it("throws for invalid JSON", () => {
    const fp = tmpFile("not json");
    expect(() => loadRules(fp)).toThrow("Invalid JSON");
  });

  it("throws for missing rules array", () => {
    const fp = tmpFile(JSON.stringify({ foo: "bar" }));
    expect(() => loadRules(fp)).toThrow("rules");
  });

  it("throws for unknown rule type", () => {
    const fp = tmpFile(JSON.stringify({
      rules: [
        {
          id: "bad-rule",
          type: "unknown_type",
          params: {},
          notify: ["stdout"],
        },
      ],
    }));
    expect(() => loadRules(fp)).toThrow("unknown type");
  });

  it("throws for missing required params", () => {
    const fp = tmpFile(JSON.stringify({
      rules: [
        {
          id: "bad-rule",
          type: "move_event",
          params: { package: "0x2" },
          notify: ["stdout"],
        },
      ],
    }));
    expect(() => loadRules(fp)).toThrow("missing required param");
  });

  it("throws for empty notify array", () => {
    const fp = tmpFile(JSON.stringify({
      rules: [
        {
          id: "bad-rule",
          type: "validator_change",
          params: {},
          notify: [],
        },
      ],
    }));
    expect(() => loadRules(fp)).toThrow("notify");
  });

  it("throws for invalid notify channel", () => {
    const fp = tmpFile(JSON.stringify({
      rules: [
        {
          id: "bad-rule",
          type: "validator_change",
          params: {},
          notify: ["slack"],
        },
      ],
    }));
    expect(() => loadRules(fp)).toThrow("unknown notify channel");
  });
});
