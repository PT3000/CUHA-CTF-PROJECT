# CUHA CTF Project

CUHA CTF 대회 운영 저장소입니다. CTFd에서 문제와 플래그를 관리하고, 트리 플러그인에서 팀별 선물 보상, 장식 구매, 배치 저장, 운영진 심사를 처리합니다.

## 저장소 구조

```text
ctfd/
├── Dockerfile
├── docker-compose.yml
└── plugins/christmas_tree/
    ├── __init__.py
    ├── judging.py
    ├── templates/
    └── assets/
        └── images/
```

## 실행

[CTFd 운영 안내](ctfd/README.md)에 따라 `.env`를 준비하고 `ctfd/`에서 실행합니다.

```sh
docker compose up -d --build --wait
```

CTFd 초기 설정에서 **Teams** 모드를 선택하고 대회 문제와 플래그를 등록합니다. 참가자는 `/christmas-tree/`에서 팀 트리를 열고, 운영진은 `/christmas-tree/judging/`에서 심사합니다.

## 관련 이슈

- [#1 절대음감 테스트](https://github.com/PT3000/CUHA-CTF-PROJECT/issues/1) · [#2 CAPTCHA](https://github.com/PT3000/CUHA-CTF-PROJECT/issues/2) · [#3 Easy_Linux](https://github.com/PT3000/CUHA-CTF-PROJECT/issues/3) · [#4 방탈출](https://github.com/PT3000/CUHA-CTF-PROJECT/issues/4)
- [#5 크리스마스 트리 연동](https://github.com/PT3000/CUHA-CTF-PROJECT/issues/5)
