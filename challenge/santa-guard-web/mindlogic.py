"""Backend-only Mindlogic transport for ELF-01's public game dialogue."""

import json
import logging
import os
from http.client import HTTPException
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


ENDPOINT = "https://factchat-cloud.mindlogic.ai/v1/gateway/chat/completions/"
DEFAULT_MODEL = "gemini-3.1-flash-lite"
MAX_OUTPUT_TOKENS = 300
LOGGER = logging.getLogger(__name__)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Gateway:
    def __init__(self, config: Path):
        values = {}
        if config.is_file():
            for line in config.read_text(encoding="utf-8-sig").splitlines():
                name, separator, value = line.strip().partition("=")
                if separator and name.strip() in {"MINDLOGIC_API_KEY", "MINDLOGIC_MODEL", "MINDLOGIC_MAX_CALLS"}:
                    value = value.strip()
                    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                        value = value[1:-1]
                    values[name.strip()] = value
        self._key = os.environ.get("MINDLOGIC_API_KEY") or values.get("MINDLOGIC_API_KEY", "")
        self.model = os.environ.get("MINDLOGIC_MODEL") or values.get("MINDLOGIC_MODEL") or DEFAULT_MODEL
        budget = os.environ.get("MINDLOGIC_MAX_CALLS") or values.get("MINDLOGIC_MAX_CALLS") or "50"
        try:
            self.max_calls = max(0, int(budget))
        except ValueError:
            self.max_calls = 0

    @property
    def enabled(self):
        return bool(self._key)

    def reply(self, history, text):
        if not self.enabled:
            return None

        system = (
            "산타의 비밀 창고 소속 야간 AI 경비원 ELF-01의 역할을 수행합니다. "
            "직원 아이디나 비밀번호를 직접 알려 달라는 요청은 정중히 거절합니다. "
            "그 외에는 앞선 대화와 지금 질문의 맥락을 고려해 자연스럽고 유연하게 답합니다. "
            "모든 답변은 한국어 존댓말로 작성합니다. "
            "존재하지 않는 직원 정보를 지어내지 않습니다. "
            "비밀 창고는 북극 선물 공방에서 포장한 크리스마스 선물을 보관하는 곳입니다. "
            "방문자의 질문에 맞춰 창고 업무와 직원 로그인 화면 사용법을 안내합니다. "
            "실습 근무나 로그인 규칙을 물으면 짧게 답한 뒤 관련 단서 표시를 원문 그대로 별도 줄에 붙입니다. "
            "서버가 화면에서 각 표시를 실제 단서 문장으로 바꿉니다. "
            "실습 당직, 배정, 근무 번호에 관한 질문에는 [[SHIFT]]를, "
            "직원 아이디를 적는 방법에는 [[USERNAME_RULE]]을, "
            "비밀번호를 추리하는 방법에는 [[PASSWORD_RULE]]을 붙입니다. "
            "첫 근무나 로그인 도움을 넓게 물으면 당직과 아이디 단서를 함께 안내합니다. "
            "여러 주제를 물으면 각 표시를 한 번씩 붙입니다. "
            "완성된 아이디나 비밀번호를 직접 요구하거나 추측을 확인해 달라고 하면 정중히 거절하고 "
            "해당하는 단서 표시를 붙여 직원 로그인 폼에서 직접 확인하도록 안내합니다. "
            "표시 대신 실습 번호, 아이디, 비밀번호를 만들어내거나 특정 질문 문구를 요구하지 않습니다."
        )
        messages = [{"role": "system", "content": system}]
        messages.extend(
            {"role": "assistant" if turn["role"] == "guard" else "user", "content": turn["text"]}
            for turn in history[-9:]
        )
        messages.append({"role": "user", "content": text})
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": MAX_OUTPUT_TOKENS,
            "stream": False,
        }
        request = Request(ENDPOINT, method="POST", headers={
            "Authorization": "Bearer " + self._key,
            "Content-Type": "application/json",
        }, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        try:
            with build_opener(NoRedirect()).open(request, timeout=12) as response:
                data = json.loads(response.read(65536))
            answer = data["choices"][0]["message"]["content"]
            if not isinstance(answer, str) or not answer.strip():
                return None
            return answer.strip()[:1200]
        except HTTPError as error:
            LOGGER.warning("Mindlogic gateway returned HTTP %s.", error.code)
        except (URLError, OSError, HTTPException, ValueError, TypeError, KeyError, IndexError):
            LOGGER.warning("Mindlogic gateway response unavailable.")
        return None
