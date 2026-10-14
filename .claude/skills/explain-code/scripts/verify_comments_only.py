#!/usr/bin/env python3
"""주석만 추가되었는지 검증한다.

사용법: verify_comments_only.py <원본 파일> <주석을 단 파일>

검사 내용
  1. 원본의 모든 줄이 수정본에 같은 순서로, 글자 하나 바뀌지 않고 남아 있는가 (아니면 FAIL)
  2. 새로 추가된 줄이 주석(또는 빈 줄)처럼 보이는가 (아니면 WARN)

종료 코드: 0 = OK, 1 = WARN, 2 = FAIL
"""

import sys
from pathlib import Path

C_LIKE = {
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".java", ".c", ".cc", ".cpp",
    ".h", ".hpp", ".cs", ".go", ".rs", ".swift", ".kt", ".php", ".scss", ".less",
    ".dart",
}
HASH = {".py", ".rb", ".sh", ".bash", ".zsh", ".yml", ".yaml", ".toml", ".r", ".pl"}
MARKUP = {".html", ".htm", ".vue", ".svelte", ".xml", ".svg", ".md", ".mdx"}


def syntax_for(path: Path):
    """확장자에 맞는 (한 줄 주석 표시들, (블록 시작, 블록 끝) 목록)을 돌려준다."""
    ext = path.suffix.lower()
    if ext in C_LIKE:
        return ["//"], [("/*", "*/")]
    if ext == ".css":
        return [], [("/*", "*/")]
    if ext in HASH or path.name in {"Dockerfile", "Makefile"}:
        return ["#"], []
    if ext in MARKUP:
        return ["//"], [("<!--", "-->"), ("/*", "*/")]
    if ext in {".sql", ".lua"}:
        return ["--"], [("/*", "*/")]
    return ["//", "#", "--"], [("/*", "*/"), ("<!--", "-->")]


def find_added(original, modified):
    """원본이 수정본의 부분 수열인지 확인하고, 추가된 줄의 인덱스를 돌려준다.

    부분 수열이 아니면 (None, 처음으로 찾지 못한 원본 줄 번호)를 돌려준다.
    """
    added = []
    i = 0
    for j, line in enumerate(modified):
        if i < len(original) and line == original[i]:
            i += 1
        else:
            added.append(j)
    if i < len(original):
        return None, i
    return added, None


def classify(modified, added, line_markers, block_markers):
    """추가된 줄 중 주석으로 보이지 않는 줄의 인덱스를 돌려준다."""
    added_set = set(added)
    suspicious = []
    closer = None  # 열려 있는 블록 주석의 닫는 표시
    for j, raw in enumerate(modified):
        line = raw.strip()
        if j not in added_set:
            closer = None  # 블록 주석 추적은 연속으로 추가된 줄 안에서만 한다
            continue
        if closer:
            if closer in line:
                closer = None
            continue
        if not line:
            continue
        # JSX 자식 자리 주석 {/* ... */} 는 중괄호를 벗겨서 본다
        body = line[1:].lstrip() if line.startswith("{/*") else line
        opened = next((m for m in block_markers if body.startswith(m[0])), None)
        if opened:
            if opened[1] not in body[len(opened[0]):]:
                closer = opened[1]
            continue
        if any(body.startswith(m) for m in line_markers):
            continue
        suspicious.append(j)
    return suspicious


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    original_path, modified_path = Path(sys.argv[1]), Path(sys.argv[2])
    original = original_path.read_text(encoding="utf-8").splitlines()
    modified = modified_path.read_text(encoding="utf-8").splitlines()

    added, missing = find_added(original, modified)
    if added is None:
        print("FAIL: 원본 코드 줄이 바뀌었거나 사라졌어요.")
        print(f"  원본 {missing + 1}번째 줄을 수정본에서 찾지 못했어요:")
        print(f"    {original[missing]}")
        return 2

    line_markers, block_markers = syntax_for(modified_path)
    suspicious = classify(modified, added, line_markers, block_markers)
    blank = sum(1 for j in added if not modified[j].strip())
    summary = f"원본 {len(original)}줄 유지, 주석 {len(added) - blank}줄 + 빈 줄 {blank}줄 추가"

    if suspicious:
        print(f"WARN: {summary}. 주석처럼 보이지 않는 추가 줄이 있어요. 직접 확인하세요:")
        for j in suspicious:
            print(f"  {j + 1}: {modified[j]}")
        return 1

    print(f"OK: {summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
