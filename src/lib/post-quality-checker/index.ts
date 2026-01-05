import * as cheerio from 'cheerio';
export const checkConsecutiveImages = (html: string): boolean => {
  if (!html) return false;

  try {
    const $ = cheerio.load(html);

    const imageComponents = $('.se-component.se-image');

    if (imageComponents.length < 4) return false;

    const containers = new Set<any>();
    imageComponents.each((_, elem) => {
      const parent = $(elem).parent()[0];
      if (parent) containers.add(parent);
    });

    let maxConsecutiveCount = 0;

    containers.forEach((container) => {
      const children = $(container).children();
      let consecutiveCount = 0;

      children.each((_, child) => {
        const $child = $(child);
        if ($child.hasClass('se-component') && $child.hasClass('se-image')) {
          consecutiveCount++;
          maxConsecutiveCount = Math.max(maxConsecutiveCount, consecutiveCount);
        } else {
          consecutiveCount = 0;
        }
      });
    });

    return maxConsecutiveCount >= 4;
  } catch {
    return false;
  }
}
