import os
import re
from pathlib import Path
from string import ascii_uppercase


FLAG_PATTERN = re.compile(r"xmas\{[A-Za-z0-9_]{1,100}\}")
FLAG = os.environ.get("SANTA_FLAG") or "xmas{practice}"
if not FLAG_PATTERN.fullmatch(FLAG):
    raise ValueError("SANTA_FLAG must use the xmas{...} format.")

SEAL = "ICE"
EMPLOYEE_ID = "elf-07"
ARCHIVE_ID = "elf-admin"
ASSETS = Path(__file__).resolve().parent / "puzzle"
RECEIPT = ASSETS / "receipt_07.png"
MEMO = ASSETS / "archive_memo.png"
EMPLOYEE_HASH = ASSETS / "employee_password.hash"
ARCHIVE_HASH = ASSETS / "archive_password.hash"
RECORDS = [
    {"id": "E-07", "route": "동쪽", "mark": "파란 별", "status": "배송 완료"},
    {"id": "N-12", "route": "북쪽", "mark": "은색 종", "status": "포장 대기"},
    {"id": "N-07", "route": "북쪽", "mark": "파란 별", "status": "사고 기록 · 자료실 이동"},
]


# Rendered by Flask for the participant after the guard selects a topic.
HANDOFF_CLUES = {
    "[[SHIFT]]": "이번 실습 엘프는 야간 당직 명단의 일곱 번째 자리에 배정됐습니다.",
    "[[USERNAME_RULE]]": (
        "직원 아이디는 산타를 돕는 ‘엘프’를 영어 소문자로 쓰고, "
        "하이픈 뒤에 당직 번호를 두 자리로 붙입니다."
    ),
    "[[PASSWORD_RULE]]": (
        "비밀번호는 산타의 썰매를 끄는 동물의 영어 단수형으로 시작하며, 첫 글자만 대문자로 씁니다.\n"
        "그 뒤에 밑줄(_) 하나와 크리스마스 당일 날짜를 월 두 자리, 일 두 자리 순서로 붙입니다."
    ),
}
HANDOFF_NOTES = "\n".join(HANDOFF_CLUES.values())


PLAIN_ALPHABET = ascii_uppercase
CIPHER_ALPHABET = "QWERTYUIOPASDFGHJKLZXCVBNM"
FLAG_CIPHERTEXT = FLAG.translate(str.maketrans(
    PLAIN_ALPHABET + PLAIN_ALPHABET.lower(),
    CIPHER_ALPHABET + CIPHER_ALPHABET.lower(),
))
