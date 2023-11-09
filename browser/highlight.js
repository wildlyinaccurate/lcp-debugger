export async function highlightArea(page, rect) {
  await page.evaluate((rect) => {
    const shadowDiv = document.createElement("div");
    shadowDiv.style.boxShadow = "0 0 0 99999px rgba(0, 0, 0, 0.5)";
    shadowDiv.style.height = `${rect.height}px`;
    shadowDiv.style.left = `${rect.left}px`;
    shadowDiv.style.position = "absolute";
    shadowDiv.style.top = `${rect.top}px`;
    shadowDiv.style.width = `${rect.width}px`;
    shadowDiv.style.zIndex = "999999";

    const innerShadowDiv = document.createElement("div");
    innerShadowDiv.style.border = "3px solid red";
    innerShadowDiv.style.height = "100%";
    innerShadowDiv.style.width = "100%";

    shadowDiv.appendChild(innerShadowDiv);
    document.body.appendChild(shadowDiv);
    document.body.style.overflow = "hidden";
  }, rect);
}
