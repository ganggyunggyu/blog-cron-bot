#!/usr/bin/env python3
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path


BLOGS = [
    {"sheetName": "제이제이", "displayName": "제이제이 (26.06.15 만료)", "blogId": "dnation09"},
    {"sheetName": "철인삼남매", "displayName": "철인삼남매 (25.12.12 만료)", "blogId": "dreamclock33"},
    {"sheetName": "사랑채마켓", "displayName": "사랑채마켓 (26.06.30 만료)", "blogId": "sarangchai_"},
    {"sheetName": "호이호이", "displayName": "호이호이 (영구-단체전환)", "blogId": "sw078"},
]
OUT_DIR = Path("outputs/blog-published-ranks")
CUTOFF = datetime(2026, 3, 29)
REFERENCE = datetime(2026, 6, 29, 12, 10)
SEEDED_CATEGORIES = {
    # 맛집 발행글이 전체글 currentPage=0 에서 일부 누락/점프되는 블로그가 있어
    # 실제 블로그 네비게이션 카테고리 번호도 같이 수집한다.
    "dnation09": ["60", "61", "62", "65", "66"],
    "dreamclock33": ["30", "127"],
    "sarangchai_": ["27"],
    "sw078": ["33"],
}


def fetch_page(blog_id: str, page: int, category_no: str = "0") -> dict:
    params = urllib.parse.urlencode(
        {
            "blogId": blog_id,
            "viewdate": "",
            "currentPage": str(page),
            "categoryNo": str(category_no),
            "parentCategoryNo": "",
            "countPerPage": "30",
        }
    )
    url = f"https://blog.naver.com/PostTitleListAsync.naver?{params}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
            "Referer": f"https://blog.naver.com/{blog_id}",
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
    )
    text = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    # Naver escapes apostrophes as \\' inside pagingHtml, which is not valid JSON.
    text = text.replace("\\'", "'")
    return json.loads(text)


def decode_title(value: str) -> str:
    return urllib.parse.unquote_plus(value or "").strip()


def parse_date(value: str) -> datetime | None:
    value = (value or "").strip()
    match = re.fullmatch(r"(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.", value)
    if match:
        return datetime(*map(int, match.groups()))
    match = re.fullmatch(r"(\d+)\s*시간 전", value)
    if match:
        return REFERENCE - timedelta(hours=int(match.group(1)))
    match = re.fullmatch(r"(\d+)\s*분 전", value)
    if match:
        return REFERENCE - timedelta(minutes=int(match.group(1)))
    match = re.fullmatch(r"(\d+)\s*일 전", value)
    if match:
        return REFERENCE - timedelta(days=int(match.group(1)))
    if value == "어제":
        return REFERENCE - timedelta(days=1)
    return None


def kst_now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def collect_blog(blog: dict) -> dict:
    row_by_log_no = {}
    oldest_seen = None
    category_seeds = set(SEEDED_CATEGORIES.get(blog["blogId"], []))
    category_stats = []

    def add_item(item: dict, page: int, category_no: str):
        nonlocal oldest_seen
        log_no = str(item.get("logNo") or "").strip()
        if not log_no:
            return False

        add_date = str(item.get("addDate") or "").strip()
        parsed = parse_date(add_date)
        if parsed:
            oldest_seen = parsed if oldest_seen is None else min(oldest_seen, parsed)
        item_category = str(item.get("categoryNo") or "").strip()
        if item_category and parsed and parsed >= CUTOFF:
            category_seeds.add(item_category)

        if log_no in row_by_log_no:
            existing = row_by_log_no[log_no]
            note = existing["비고"]
            marker = f"categoryNo={category_no};currentPage={page}"
            if marker not in note:
                existing["비고"] = f"{note} | {marker}"
            return False

        title = decode_title(str(item.get("title") or ""))
        is_not_open = str(item.get("isPostNotOpen") or "0")
        open_type = str(item.get("openType") or "")
        private_status = "비공개/제한" if is_not_open == "1" else "공개"

        row_by_log_no[log_no] = {
            "순위": "",
            "글": title,
            "링크": f"https://blog.naver.com/{blog['blogId']}/{log_no}",
            "키워드": title,
            "발행일": add_date,
            "블로그": blog["displayName"],
            "블로그ID": blog["blogId"],
            "글번호": log_no,
            "매칭": "블로그 글목록/카테고리 네비게이션",
            "비고": (
                f"categoryNo={category_no};itemCategoryNo={item_category};currentPage={page};"
                f"openType={open_type};isPostNotOpen={is_not_open};status={private_status}"
            ),
            "_postDateSort": parsed.strftime("%Y-%m-%d %H:%M:%S") if parsed else "",
        }
        return True

    def collect_category(category_no: str, max_pages: int = 200):
        page = 1
        total_count = None
        category_seen = set()
        stop_reason = ""
        pages_fetched = 0

        while page <= max_pages:
            data = fetch_page(blog["blogId"], page, category_no)
            post_list = data.get("postList") or []
            total_count = int(data.get("totalCount") or total_count or 0)
            pages_fetched = page
            if not post_list:
                stop_reason = f"empty-page-{page}"
                break

            page_dates = []
            new_in_category = 0
            for item in post_list:
                log_no = str(item.get("logNo") or "").strip()
                if not log_no:
                    continue
                if log_no not in category_seen:
                    category_seen.add(log_no)
                    new_in_category += 1

                parsed = parse_date(str(item.get("addDate") or ""))
                if parsed:
                    page_dates.append(parsed)
                add_item(item, page, category_no)

            if new_in_category == 0:
                stop_reason = f"repeated-page-{page}"
                break
            if page_dates and max(page_dates) < CUTOFF:
                stop_reason = f"page-{page}-older-than-cutoff"
                break
            if total_count and len(category_seen) >= total_count:
                stop_reason = "total-count-reached"
                break

            page += 1
            time.sleep(0.08)

        category_stats.append(
            {
                "categoryNo": category_no,
                "totalCount": total_count,
                "pagesFetched": pages_fetched,
                "uniqueRows": len(category_seen),
                "stopReason": stop_reason,
            }
        )

    collect_category("0")

    for category_no in sorted(category_seeds, key=lambda value: int(value) if value.isdigit() else 999999):
        if category_no and category_no != "0":
            collect_category(category_no)

    rows = sorted(
        row_by_log_no.values(),
        key=lambda row: (row.get("_postDateSort") or "0000-00-00 00:00:00", row["글번호"]),
        reverse=True,
    )
    for index, row in enumerate(rows, start=1):
        row["순위"] = str(index)
        row.pop("_postDateSort", None)

    return {
        **blog,
        "rows": rows,
        "totalCount": next((item["totalCount"] for item in category_stats if item["categoryNo"] == "0"), None),
        "pagesFetched": sum(item["pagesFetched"] for item in category_stats),
        "oldestLoaded": oldest_seen.strftime("%Y-%m-%d") if oldest_seen else "",
        "stopReason": "; ".join(f"{item['categoryNo']}:{item['stopReason']}" for item in category_stats),
        "categoryStats": category_stats,
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    for blog in BLOGS:
        print(f"[nav] {blog['sheetName']} {blog['blogId']}", flush=True)
        result = collect_blog(blog)
        print(
            f"[nav] {blog['sheetName']} rows={len(result['rows'])} pages={result['pagesFetched']} oldest={result['oldestLoaded']} stop={result['stopReason']}",
            flush=True,
        )
        results.append(result)

    stamp = datetime.now().strftime("%Y%m%d%H%M%S")
    payload = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "generatedAtKst": kst_now(),
        "rankingBasis": "blog.naver.com PostTitleListAsync currentPage 네비게이션 기준",
        "keywordBasis": "블로그 글목록 제목",
        "cutoffDateKst": CUTOFF.strftime("%Y-%m-%d"),
        "headers": ["순위", "글", "링크", "키워드", "발행일", "블로그", "블로그ID", "글번호", "매칭", "비고"],
        "results": results,
        "summary": [
            {
                "sheetName": item["sheetName"],
                "blogId": item["blogId"],
                "rows": len(item["rows"]),
                "totalCount": item["totalCount"],
                "pagesFetched": item["pagesFetched"],
                "oldestLoaded": item["oldestLoaded"],
                "stopReason": item["stopReason"],
            }
            for item in results
        ],
    }
    out_path = OUT_DIR / f"target-blog-navigation-posts-{stamp}.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(out_path)
    print(json.dumps(payload["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
