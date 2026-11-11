import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const html = readFileSync("public/nova-era.html", "utf8");
const saveCode = html.slice(html.indexOf("async function saveEd(){"), html.indexOf("var LB=null;"));

async function saveAs(barber: string | null, old: Record<string, unknown> = {}) {
  const photoWrites: string[] = [];
  const setSite = vi.fn().mockResolvedValue(undefined);
  const profile = (label: string) => ({ wa: "", ig: "", bio: "", photos: [`data:image/jpeg;base64,${label}`] });
  const elements = { edErr: { classList: { add: vi.fn() } }, edSave: { disabled: false, textContent: "" } };
  const run = new Function("ED", "BARBERS", "ME", "$", "waNum", "PUB", "iso", "siteRef", "photoRef", "siteMeta", "sitePh", "okImg", "edErr", "setTimeout", `${saveCode}; return saveEd();`);
  await run(
    { barbers: { b1: profile("Biel"), b2: profile("Nicolas") }, links: [], closed: [], loc: "" },
    [{ id: "b1" }, { id: "b2" }], { b: barber },
    (id: keyof typeof elements) => elements[id], (value: string) => value, /^https?:\/\//,
    () => "2026-11-11", { set: setSite },
    { doc: (key: string) => ({ set: async () => { photoWrites.push(key); }, delete: async () => { photoWrites.push(key); } }) },
    { barbers: old }, null, (value: string) => value.startsWith("data:image/jpeg;base64,"),
    (message: string) => { throw new Error(message); }, () => {},
  );
  return { photoWrites, meta: setSite.mock.calls[0]?.[0] };
}

describe("Shared site save", () => {
  it("lets Biel save without attempting to write Nicolas's unsynchronized photos", async () => {
    const result = await saveAs("b1");
    expect(result.photoWrites).toEqual(["b1_0"]);
    expect(result.meta.barbers.b1.n).toBe(1);
  });

  it("lets Nicolas save without writing or deleting Biel's photos", async () => {
    const existing = { wa: "123", ig: "https://instagram.com/biel", bio: "", n: 3 };
    const result = await saveAs("b2", { b1: existing });
    expect(result.photoWrites).toEqual(["b2_0"]);
    expect(result.meta.barbers.b1).toEqual(existing);
  });

  it("keeps Arthur's ability to save photos for both barbers", async () => {
    const result = await saveAs(null);
    expect(result.photoWrites).toEqual(["b1_0", "b2_0"]);
  });
});