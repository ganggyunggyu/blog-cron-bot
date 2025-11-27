import * as cheerio from 'cheerio';

/**
 * 연속된 이미지 컴포넌트가 4개 이상인지 체크
 * (식당 키워드 포스트 수정 필요 여부 판정)
 *
 * @param html 블로그 포스트 HTML
 * @returns 연속된 이미지 4개 이상이면 true, 아니면 false
 */
export const checkConsecutiveImages = (html: string): boolean => {
  if (!html) return false;

  try {
    const $ = cheerio.load(html);

    // se-component se-image 클래스를 가진 모든 요소 찾기
    const imageComponents = $('.se-component.se-image');

    if (imageComponents.length < 4) return false;

    // 부모 컨테이너별로 연속성 체크
    const containers = new Set<any>();
    imageComponents.each((_, elem) => {
      const parent = $(elem).parent()[0];
      if (parent) containers.add(parent);
    });

    // 각 컨테이너에서 연속된 이미지 카운트
    let maxConsecutiveCount = 0;

    containers.forEach((container) => {
      const children = $(container).children();
      let consecutiveCount = 0;

      children.each((_, child) => {
        const $child = $(child);
        // se-component와 se-image 클래스 모두 있는지 체크
        if ($child.hasClass('se-component') && $child.hasClass('se-image')) {
          consecutiveCount++;
          maxConsecutiveCount = Math.max(maxConsecutiveCount, consecutiveCount);
        } else {
          consecutiveCount = 0; // 연속성 끊김
        }
      });
    });

    return maxConsecutiveCount >= 4;
  } catch {
    return false;
  }
}
