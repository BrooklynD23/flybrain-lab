import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

interface Script {
  cues: { tMs: number; text: string }[];
}
const script = (id: string): Script =>
  JSON.parse(readFileSync(`public/narration/${id}.json`, "utf8"));

const pick = (page: Page, label: string) =>
  page.getByRole("radio", { name: new RegExp(label, "i") }).check();

const seconds = async (page: Page) => {
  const [m, s] = (await page.locator(".fbl-time-current").innerText()).split(
    ":",
  );
  return Number(m) * 60 + Number(s);
};

/** Distinct colours in a canvas screenshot; a blank canvas has exactly one. */
async function colourCount(page: Page, index: number) {
  const png = await page.locator("canvas").nth(index).screenshot();
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(
      await (await fetch(`data:image/png;base64,${b64}`)).blob(),
    );
    const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < px.length; i += 4) {
      seen.add((px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!);
    }
    return seen.size;
  }, png.toString("base64"));
}

test("demo flow", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.locator("canvas")).toHaveCount(2);
  await expect(page.getByText("fixture data")).toBeVisible();
  for (const i of [0, 1]) {
    await expect.poll(() => colourCount(page, i)).toBeGreaterThan(1);
  }

  // Feeding: restart playback and watch the timeline advance.
  await pick(page, "Feeding");
  await page.getByRole("slider", { name: "Seek" }).fill("0");
  const play = page.getByRole("button", { name: /^(Play|Pause)$/ });
  if ((await play.innerText()) === "Play") await play.click();
  const t0 = await seconds(page);
  await expect.poll(() => seconds(page), { timeout: 2000 }).toBeGreaterThan(t0);
  await expect(page.locator(".fbl-narration-cue")).not.toBeEmpty();

  // Scrub to 1500 ms: cue must match the script.
  await play.click();
  await page.getByRole("slider", { name: "Seek" }).fill("1500");
  const cue = script("feeding")
    .cues.filter((c) => c.tMs <= 1500)
    .at(-1)!;
  await expect(page.locator(".fbl-narration-cue")).toHaveText(cue.text);

  await pick(page, "Grooming");
  await expect(
    page.locator("label", { hasText: "Grooming" }).locator(".fbl-clip-source"),
  ).toHaveText("Keyframed");

  // Suggested question -> replay answer.
  await page.locator("section li button").first().click();
  await expect(
    page.locator("section p[aria-live=polite]").last(),
  ).not.toBeEmpty();

  await page.getByText("Data sources and licences").click();
  await expect(page.locator("details")).toContainText("CC BY-NC 4.0");
  await expect(page.locator("details")).toContainText("Non-commercial");

  expect(errors).toEqual([]);
});

test("?quality=low checks the low-quality box", async ({ page }) => {
  await page.goto("/?quality=low");
  await expect(page.getByLabel("Low quality (faster)")).toBeChecked();
});

test("?debug=1 shows fps", async ({ page }) => {
  await page.goto("/?debug=1");
  await expect(page.getByTestId("fps")).toHaveText(/\d+ fps/);
});
