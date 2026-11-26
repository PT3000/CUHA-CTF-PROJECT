# 크리스마스 트리 CTFd 운영본

공식 CTFd 3.8.9 이미지에 트리 꾸미기 플러그인을 추가합니다. CTFd가 플래그를 채점하고, 플러그인이 팀별 정답 기록을 읽어 선물과 꾸미기 포인트를 지급합니다. 트리 배치, 보유 장식, 포인트는 MariaDB에 저장합니다.

이미지를 빌드할 때 CTFd 3.8.9의 문제 목록에 태그를 일괄 조회하는 패치를 적용합니다.

## 디렉터리 구조

- `Dockerfile`, `docker-compose.yml`, `.env.example`은 운영 환경을 구성합니다.
- `plugins/christmas_tree/`에는 CTFd 플러그인이 있습니다.
- `plugins/christmas_tree/templates/`에는 트리 꾸미기를 포함한 CTFd 화면 템플릿이 있고, `plugins/christmas_tree/assets/`에는 스크립트, 스타일시트, 이미지가 있습니다.

## 실행

1. Docker Compose가 설치된 환경에서 이 `ctfd` 디렉터리로 이동합니다.
2. `.env.example`을 `.env`로 복사합니다. Windows PowerShell에서는 `Copy-Item .env.example .env`를 사용합니다.
3. `.env`의 `CTFD_SECRET_KEY`, `CTFD_DB_PASSWORD`, `CTFD_DB_ROOT_PASSWORD`에 각각 다른 랜덤 값을 넣습니다. DB 비밀번호는 연결 URL에서 안전하게 쓰도록 아래 명령으로 생성한 16진수 값을 사용합니다. 명령을 실행할 때마다 새 값이 나옵니다.

   ```sh
   docker run --rm --entrypoint python ghcr.io/ctfd/ctfd:3.8.9 -c "import secrets; print(secrets.token_hex(32))"
   ```

4. 운영본을 빌드하고 실행합니다.

   ```sh
   docker compose config --quiet
   docker compose up -d --build --wait
   ```

5. `http://localhost:8000/`에서 CTFd 관리자 계정을 만듭니다. 초기 설정에서 **Team Mode**를 선택하고 팀 정원을 확인합니다. 팀 정원 입력란의 기본값은 4명입니다. 관리자 화면에서 문제와 실제 플래그를 등록하거나 CTFd 백업을 가져옵니다.
6. 참가자는 개인 계정으로 가입한 뒤 팀을 만들거나 합류합니다. **챌린지**에서 팀원들과 풀이 상태를 공유하고, **팀 점수판**에서 팀별 순위와 점수 변화를 확인합니다. [팀 생성 및 합류](https://docs.ctfd.io/tutorials/teams/creating-and-joining-teams/)

## 팀전 운영

- **설정 → 언어 및 지역**에서 기본 언어를 **한국어**로 선택할 수 있습니다.
- **설정 → 계정**에서 팀 정원과 팀 생성 허용 여부를 설정합니다. [계정 설정](https://docs.ctfd.io/docs/settings/accounts/)
- **팀**에서 팀 숨김·차단, 팀 정보 수정 및 팀원 이동을 처리합니다. CTFd의 팀원 이동은 해당 참가자의 이전 팀 제출·보상·잠금 해제 기록을 삭제합니다. [팀 관리](https://docs.ctfd.io/docs/accounts/teams/)
- **제출 로그**에서 팀, 제출자, 제출 시간, 플래그 및 판정 결과를 확인합니다. 첫 페이지의 제출 목록은 8초 간격으로 갱신을 확인합니다.
- 참가자 챌린지 목록과 팀 점수판도 5초 간격으로 갱신됩니다. [팀전 규칙](https://docs.ctfd.io/docs/accounts/user-mode/)

## 대회 설정

| 환경 변수 | 설정 |
| --- | --- |
| `CHRISTMAS_TREE_CHALLENGE_IDS` | 보상을 연동할 CTFd 챌린지의 숫자 ID를 쉼표로 구분합니다. 문제를 등록한 뒤 CTFd 관리자 화면에서 확인한 ID를 사용합니다. 비워 두면 공개 상태의 모든 CTFd 문제가 연동됩니다. |
| `CHRISTMAS_TREE_STARTING_POINTS` | 새 팀 트리를 만들 때 지급할 꾸미기 포인트입니다. 기본값은 `30000`입니다. |
| `CHRISTMAS_TREE_POINTS_PER_SOLVE` | 첫 정답 한 건에 지급하는 꾸미기 포인트입니다. 기본값은 `500`입니다. |
| `CTFD_PORT` | 호스트에서 접근할 포트입니다. 기본값은 `8000`입니다. |

환경 변수를 바꾼 뒤 `docker compose up -d --wait`를 실행합니다. 시작 포인트는 새 팀 트리에 적용됩니다. 풀이 점수는 CTFd가 관리하며, 장식 구매 시에는 꾸미기 포인트만 사용합니다.

## 운영 서버 접속

기본 접속 주소는 호스트의 `127.0.0.1`입니다. 참가자에게 공개할 때에는 운영 서버의 HTTPS 리버스 프록시를 사용합니다. 프록시가 CTFd에 `X-Forwarded-*` 헤더를 설정하는 경우 `CTFD_REVERSE_PROXY=true`로 설정합니다. DB, 캐시, 첨부 파일은 각각 Docker 볼륨에 보관됩니다.

CTFd 컨테이너의 출력 로그는 파일당 10MB로 최대 3개까지 보관합니다. 서비스 상태는 로그인 페이지로 확인하므로 대회 종료 후 챌린지 공개를 막아도 상태 확인이 가능합니다.

- [CTFd 설치 문서](https://docs.ctfd.io/docs/deployment/installation/)
- [CTFd 3.8.9 이미지](https://github.com/CTFd/CTFd/pkgs/container/ctfd)
