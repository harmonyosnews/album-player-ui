#!/usr/bin/env python3
import json
import sys

import pymupdf

TARGETS = {
    "ch1": "1. 它是什么",
    "ch2": "2. 安装与首次使用",
    "ch3": "3. 五分钟出声",
    "ch4": "4. 界面总览",
    "ch5": "5. 首页、专辑",
    "ch6": "6. 当前播放队列",
    "ch7": "7. 网络电台",
    "ch8": "8. 播放列表与文件浏览",
    "ch9": "9. 设置",
    "ch10": "10. 手机与平板",
    "ch11": "11. 常见问题",
    "ch12": "12. 安全与运维纪律",
    "ch13": "13. 版本、发布包与求助信息",
    "appA": "附录 A：",
    "appB": "附录 B：",
    "appC": "附录 C：",
}


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: analyze_toc.py <pdf>")
    doc = pymupdf.open(sys.argv[1])
    found = {}
    for key, needle in TARGETS.items():
        page_number = None
        for index in range(2, doc.page_count):
            hits = doc[index].search_for(needle)
            if hits:
                page_number = index + 1
                break
        if page_number is None:
            raise SystemExit(f"heading not found: {key} ({needle})")
        found[key] = page_number
    print(json.dumps(found, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
