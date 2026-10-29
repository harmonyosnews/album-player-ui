#!/usr/bin/env python3
import json
import sys

import pymupdf

TITLES = [
    ("1. 它是什么，不做什么", "ch1"),
    ("2. 安装与首次使用", "ch2"),
    ("3. 五分钟出声", "ch3"),
    ("4. 界面总览", "ch4"),
    ("5. 首页、专辑、艺术家与搜索", "ch5"),
    ("6. 当前播放队列", "ch6"),
    ("7. 网络电台", "ch7"),
    ("8. 播放列表与文件浏览", "ch8"),
    ("9. 设置", "ch9"),
    ("10. 手机与平板", "ch10"),
    ("11. 常见问题", "ch11"),
    ("12. 安全与运维纪律", "ch12"),
    ("13. 版本、发布包与求助信息", "ch13"),
    ("附录 A：用户协议、免责声明与第三方边界", "appA"),
    ("附录 B：Apache License 2.0 全文", "appB"),
    ("附录 C：NOTICE 与第三方说明", "appC"),
]


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: finalize_pdf.py <rendered.pdf> <toc.json> <output.pdf>")
    source, toc_path, output = sys.argv[1:]
    toc = json.loads(open(toc_path, encoding="utf-8").read())
    doc = pymupdf.open(source)
    total = doc.page_count
    for index in range(1, total):
        page = doc[index]
        rect = pymupdf.Rect(0, page.rect.height - 13 * 72 / 25.4,
                            page.rect.width, page.rect.height - 7 * 72 / 25.4)
        page.insert_textbox(
            rect,
            f"{index + 1} / {total}",
            fontsize=8,
            fontname="helv",
            color=(0.46, 0.49, 0.54),
            align=pymupdf.TEXT_ALIGN_CENTER,
        )
    doc.set_metadata({
        "title": "APUI 使用手册 1.0.0",
        "author": "harmonyosnews",
        "subject": "Album Player UI (APUI) 使用手册",
        "keywords": "APUI, Album Player, aplayer, Web UI, 使用手册",
        "creator": "APUI project",
        "producer": "APUI documentation build",
    })
    bookmarks = [[1, title, toc[key], ""] for title, key in TITLES]
    doc.set_toc(bookmarks)
    doc.save(output, garbage=4, deflate=True)
    print(f"PDF {output} pages={total}")


if __name__ == "__main__":
    main()
