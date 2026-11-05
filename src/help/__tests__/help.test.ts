import { describe, expect, it } from "vitest";
import { CATALOG } from "../../domain/hardware/catalog";
import { ControlStation } from "../../engine/station";
import { BLOCK_TYPES } from "../../engine/registry";
import { SCENARIOS } from "../../engine/scenarios";
import { toStationDb } from "../../engine/config";
import { refMatch } from "../../features/operator/AlarmManager";
import { displaysFor } from "../../features/operator/displays";
import { BLOCK_HELP, PARAM_RU, SCREEN_HELP } from "../content";
import { resolve } from "../help";

describe("help", () => {
  it("has a full help page for every block type", () => {
    for (const t of Object.keys(BLOCK_TYPES)) {
      expect(BLOCK_HELP[t], t).toBeDefined();
      expect(resolve(`block:${t}`).kind).toBe("doc");
    }
  });
  it("key parameters named in block help exist in that block", () => {
    for (const [t, d] of Object.entries(BLOCK_HELP))
      for (const k of d.keys ?? [])
        expect(
          BLOCK_TYPES[t].params.some((p) => p.name === k),
          `${t}.${k}`,
        ).toBe(true);
  });
  it("resolves parameters, screens and hardware", () => {
    expect(resolve("param:PID.PBAND").kind).toBe("param");
    expect(resolve("param:MA").kind).toBe("param");
    for (const k of Object.keys(SCREEN_HELP))
      expect(resolve(`screen:${k}`).kind).toBe("doc");
    for (const c of CATALOG) expect(resolve(`hw:${c.id}`).kind).toBe("hw");
    expect(resolve("screen:nope").kind).toBe("none");
  });
  it("Russian parameter texts refer to real parameters", () => {
    const all = new Set(
      Object.values(BLOCK_TYPES).flatMap((t) => t.params.map((p) => p.name)),
    );
    for (const k of Object.keys(PARAM_RU)) expect(all.has(k), k).toBe(true);
  });
});

describe("operator", () => {
  it("alarm filter wildcards", () => {
    expect(refMatch("", "REACTOR:TIC401")).toBe(true);
    expect(refMatch("REACTOR:*", "REACTOR:TIC401")).toBe(true);
    expect(refMatch("*:TIC*", "REACTOR:TIC401")).toBe(true);
    expect(refMatch("TIC*", "REACTOR:TIC401")).toBe(true);
    expect(refMatch("WFI*:*", "REACTOR:TIC401")).toBe(false);
    expect(refMatch("tic40", "REACTOR:TIC401")).toBe(true);
  });
  it("every scenario has a process graphic", () => {
    for (const s of SCENARIOS) {
      const st = new ControlStation(toStationDb(s.cfg()));
      expect(displaysFor(st).length, s.id).toBeGreaterThan(0);
    }
  });
});
