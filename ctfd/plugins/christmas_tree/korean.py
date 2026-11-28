import re

from CTFd.plugins import override_template

from . import korean_operations, korean_participant, korean_team


USER_FORM_LABELS = {
    f"{{{{ form.{field}.label }}}}": f'{{{{ form.{field}.label(text="{translation}") }}}}'
    for field, translation in {
        "name": "이름", "email": "이메일", "language": "언어", "password": "비밀번호",
        "website": "웹사이트", "affiliation": "소속", "country": "국가",
    }.items()
}
USER_FORM_LABELS.update({
    f'{{{{ form.{field}.label(class="form-check-label") }}}}':
        f'{{{{ form.{field}.label(text="{translation}", class="form-check-label") }}}}'
    for field, translation in {
        "verified": "인증 완료", "hidden": "숨김", "banned": "차단",
        "change_password": "다음 로그인 시 비밀번호 변경 요구", "notify": "이메일로 알림 보내기",
    }.items()
})
USER_FORM_LABELS['id="type-select") }}'] = (
    'id="type-select") | replace(">User<"|safe, ">참가자<"|safe) '
    '| replace(">Admin<"|safe, ">운영진<"|safe) }}'
)


TEXT = {
    "admin/base.html": {
        "Admin Panel": "운영진 관리",
        "Statistics": "제출 현황",
        "Notifications": "알림",
        "Pages": "페이지",
        "All Pages": "전체 페이지",
        "New Page": "페이지 추가",
        "Users": "참가자",
        "Teams": "팀",
        "Scoreboard": "점수판",
        "Challenges": "문제 관리",
        "Submissions": "제출 로그",
        "All Submissions": "전체 제출",
        "Correct Submissions": "정답 제출",
        "Incorrect Submissions": "오답 제출",
        "Config": "설정",
        "Plugins": "플러그인",
        "A new CTFd version is available!": "새 버전을 사용할 수 있습니다.",
    },
    "admin/scoreboard.html": {
        "Scoreboard": "점수판",
        "Teams": "팀 순위",
        "Users": "참가자 순위",
    },
    "admin/scoreboard/standings.html": {
        "Place": "순위",
        "Team": "팀",
        "User": "참가자",
        "Name": "이름",
        "Score": "점수",
        "Bracket": "부문",
        "Visibility": "공개 상태",
        "Official": "공식 계정",
        "Hidden": "숨김",
        "Banned": "차단",
    },
    "admin/scoreboard/users.html": {
        "Place": "순위",
        "User": "참가자",
        "Name": "이름",
        "Team": "팀",
        "Score": "점수",
        "Bracket": "부문",
        "Visibility": "공개 상태",
        "Official": "공식 계정",
        "Hidden": "숨김",
        "Banned": "차단",
    },
    "admin/users/users.html": {
        "User": "참가자",
        "Email": "이메일",
        "Country": "국가",
        "Admin": "운영진",
        "Verified": "인증 완료",
        "Hidden": "숨김",
        "Banned": "차단",
        "Official": "공식 계정",
    },
    "admin/users/user.html": {
        "Edit User": "참가자 수정",
        "User Statistics": "참가자 통계",
        "Award User": "참가자에게 점수 지급",
        "Email User": "참가자에게 이메일 보내기",
        "IP Addresses": "IP 주소",
        "admin": "운영진",
        "verified": "인증 완료",
        "hidden": "숨김",
        "banned": "차단",
        "Official": "공식 계정",
        "place": "위",
        "points": "점",
        "Solves": "정답",
        "Fails": "오답",
        "Awards": "추가 점수",
        "Missing": "미해결",
        "Challenge": "문제",
        "Submitted": "제출값",
        "Category": "분류",
        "Value": "점수",
        "Time": "시각",
        "Name": "이름",
        "Description": "설명",
        "Date": "날짜",
        "Icon": "아이콘",
    },
    "admin/notifications.html": {"Notifications": "알림", "Send": "보내기"},
    "admin/modals/users/create.html": {"Optional": "선택 사항"},
    "admin/configs/localization.html": {"Update": "저장"},
}

REPLACEMENTS = {
    "admin/base.html": {
        "<html>": '<html lang="ko">',
        'aria-label="Toggle navigation"': 'aria-label="메뉴 열기 또는 닫기"',
        'target="_blank">\n\t\t\t\t\t\t\t<i class="far fa-question-circle">':
            'target="_blank" aria-label="도움말">\n\t\t\t\t\t\t\t<i class="far fa-question-circle">',
        "Plugins <span": "플러그인 <span",
        "<br> Version ": "<br> 버전 ",
    },
    "admin/scoreboard.html": {'title="Hide/Unhide Accounts"': 'title="계정 숨김 설정"'},
    "admin/scoreboard/standings.html": {
        "{{ get_mode_as_word(capitalize=True) }}": "{{ '팀' if Configs.user_mode == 'teams' else '참가자' }}",
    },
    "admin/users/users.html": {
        "<h1>Users": "<h1>참가자",
        'title="Create User"': 'title="참가자 추가"',
        'title="Edit Users"': 'title="참가자 수정"',
        'title="Delete Users"': 'title="참가자 삭제"',
        'placeholder="Search for matching users"': 'placeholder="참가자 검색"',
        "Searching for users with <strong>{{ field }}</strong> matching <strong>{{ q }}</strong>":
            "<strong>{{ field }}</strong>의 검색어 <strong>{{ q }}</strong>에 해당하는 참가자",
        "Page {{ users.page }} of {{ users.total }} results": "{{ users.total }}개 결과 중 {{ users.page }}페이지",
    },
    "admin/users/user.html": {'aria-label="Close"': 'aria-label="닫기"'},
    "admin/modals/users/edit.html": {
        **USER_FORM_LABELS,
        'float-right modal-action") }}': 'float-right modal-action", value="저장") }}',
    },
    "admin/modals/users/create.html": {
        **USER_FORM_LABELS,
        'float-right modal-action") }}': 'float-right modal-action", value="참가자 추가") }}',
    },
    "admin/notifications.html": {
        '{{ form.title.label }}': '{{ form.title.label(text="제목") }}',
        '{{ form.content.label }}': '{{ form.content.label(text="내용") }}',
        '{{ form.type.label }}': '{{ form.type.label(text="알림 유형") }}',
        '{{ form.sound.label }}': '{{ form.sound.label(text="알림 소리") }}',
        'aria-label="Close"': 'aria-label="닫기"',
    },
    "admin/configs/localization.html": {
        "{{ form.default_locale.label }}": '<label for="default_locale">기본 언어</label>',
        "{{ form.default_locale.description }}": "참가자가 언어를 따로 설정하지 않았을 때 사용할 언어입니다.",
    },
    "components/navbar.html": {'aria-label="Toggle navigation"': 'aria-label="메뉴 열기 또는 닫기"'},
}

# These pages retain the plugin script block and inherit the stock page content.
SCORE_GRAPH_PAGES = (
    "users/public.html",
    "users/private.html",
    "teams/public.html",
    "teams/private.html",
    "scoreboard.html",
)


def register_korean_templates(app):
    tables = [(TEXT, REPLACEMENTS)]
    tables.extend((locale.TEXT, locale.REPLACEMENTS) for locale in (korean_team, korean_operations, korean_participant))
    for text, replacements in tables:
        for template in sorted(text.keys() | replacements.keys()):
            if template == "components/navbar.html":
                continue
            name = f"core/{template}" if template in SCORE_GRAPH_PAGES else template
            source, _, _ = app.jinja_loader.get_source(app.jinja_env, name)
            for english, korean in replacements.get(template, {}).items():
                source = source.replace(english, korean)
            labels = text.get(template, {})
            if labels:
                choices = "|".join(re.escape(label) for label in labels)
                text_nodes = re.compile(rf"(?<=>)(\s*)({choices})(\s*)(?=<)")
                source = text_nodes.sub(
                    lambda match: match[1] + labels[match[2]] + match[3], source
                )
            override_template(name, source)
