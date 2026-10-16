import { expect, test } from "@playwright/test";

test("390px layout: no h-scroll, stacked panes, 44px controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("canvas")).toHaveCount(2);

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const [a, b] = await Promise.all(
    [0, 1].map((i) => page.locator(".fbl-pane").nth(i).boundingBox()),
  );
  expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height - 1);

  const targets = page.locator(
    ".fbl-behavior-option, .fbl-play-toggle, .fbl-scrubber, .fbl-quality-toggle",
  );
  for (const box of await Promise.all(
    (await targets.all()).map((t) => t.boundingBox()),
  )) {
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});
