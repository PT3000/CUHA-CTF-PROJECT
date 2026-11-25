# 크리스마스 트리 CTFd 운영본

공식 CTFd 3.8.9 이미지에 트리 꾸미기 플러그인을 추가합니다. CTFd가 플래그를 채점하고, 플러그인이 팀별 정답 기록을 읽어 선물과 꾸미기 포인트를 지급합니다. 트리 배치, 보유 장식, 포인트는 MariaDB에 저장합니다.

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

5. `http://localhost:8000/`에서 CTFd 관리자 계정을 만들고 계정 모드를 **Teams**로 선택합니다. 관리자 화면에서 문제와 실제 플래그를 등록하거나 CTFd 백업을 가져옵니다.
6. 팀 계정으로 로그인해서 CTFd **Challenges**에서 플래그를 제출하고, `http://localhost:8000/christmas-tree/`에서 팀 트리를 엽니다. 다른 팀원이 같은 팀으로 접속해 구매와 배치를 확인할 수 있습니다.

## 대회 설정

| 환경 변수 | 설정 |
| --- | --- |
| `CHRISTMAS_TREE_CHALLENGE_IDS` | 보상을 연동할 CTFd 챌린지의 숫자 ID를 쉼표로 구분합니다. 문제를 등록한 뒤 CTFd 관리자 화면에서 확인한 ID를 사용합니다. 비워 두면 공개 상태의 모든 CTFd 문제가 연동됩니다. |
| `CHRISTMAS_TREE_STARTING_POINTS` | 새 팀 트리를 만들 때 지급할 꾸미기 포인트입니다. 기본값은 `30000`입니다. |
| `CHRISTMAS_TREE_POINTS_PER_SOLVE` | 첫 정답 한 건에 지급하는 꾸미기 포인트입니다. 기본값은 `500`입니다. |
| `CHRISTMAS_TREE_ART_WEIGHT` | 최종 집계에서 트리 심사가 차지하는 비율입니다. `0`부터 `100`까지 설정할 수 있으며 기본값은 `20`입니다. |
| `CTFD_PORT` | 호스트에서 접근할 포트입니다. 기본값은 `8000`입니다. |

환경 변수를 바꾼 뒤 `docker compose up -d --wait`를 실행합니다. 시작 포인트는 새 팀 트리에 적용됩니다. 풀이 점수는 CTFd가 관리하며, 장식 구매 시에는 꾸미기 포인트만 사용합니다.

## 운영진 심사

관리자는 `/christmas-tree/judging/`에서 팀 트리를 미리 보고 각 팀에 0~100점을 줄 수 있습니다. 이 화면에서 설정한 심사 비율을 적용한 합산 순위를 확인할 수 있습니다. CTFd 기본 점수판에서는 풀이 점수를 확인할 수 있습니다.

## 운영 서버 접속

기본 접속 주소는 호스트의 `127.0.0.1`입니다. 참가자에게 공개할 때에는 운영 서버의 HTTPS 리버스 프록시를 사용합니다. 프록시가 CTFd에 `X-Forwarded-*` 헤더를 설정하는 경우 `CTFD_REVERSE_PROXY=true`로 설정합니다. DB, 캐시, 첨부 파일은 각각 Docker 볼륨에 보관됩니다.

- [CTFd 설치 문서](https://docs.ctfd.io/docs/deployment/installation/)
- [CTFd 3.8.9 이미지](https://github.com/CTFd/CTFd/pkgs/container/ctfd)
