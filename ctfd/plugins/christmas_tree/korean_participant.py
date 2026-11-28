"""Korean labels missing from the core CTFd 3.8.9 translation catalog."""


_GRAPH_LABELS = {
    '`Solves (${getSolvePercentage()}%)`': '`정답 (${getSolvePercentage()}%)`',
    '`Fails (${getFailPercentage()}%)`': '`오답 (${getFailPercentage()}%)`',
}

_SETUP_FIELDS = {
    "ctf_name": ("대회 이름", "사이트에 표시할 대회 이름입니다."),
    "ctf_description": ("대회 설명", "대회에 대한 설명을 입력하세요."),
    "user_mode": ("참가 방식", "팀전 또는 개인전으로 대회를 진행할 수 있습니다."),
    "challenge_visibility": ("문제 공개 범위", "누가 문제 목록을 볼 수 있는지 설정합니다."),
    "account_visibility": ("계정 공개 범위", "누가 참가자와 팀 정보를 볼 수 있는지 설정합니다."),
    "score_visibility": ("점수 공개 범위", "누가 점수와 풀이 기록을 볼 수 있는지 설정합니다."),
    "registration_visibility": ("회원가입 허용 범위", "누가 새 계정을 만들 수 있는지 설정합니다."),
    "verify_emails": ("이메일 인증", "참가 전에 이메일 인증을 요구할지 설정합니다."),
    "team_size": ("팀당 최대 인원", "팀전에서만 적용됩니다. 0명으로 설정하면 인원 제한이 없습니다."),
    "name": ("관리자 아이디", "관리자 로그인에 사용할 아이디입니다."),
    "email": ("관리자 이메일", "관리자 계정에 사용할 이메일 주소입니다."),
    "password": ("관리자 비밀번호", "관리자 로그인에 사용할 비밀번호입니다."),
    "ctf_logo": ("로고", "사이트에 표시할 로고입니다. 선택 사항입니다."),
    "ctf_banner": ("배너", "홈에 표시할 배너입니다. 선택 사항입니다."),
    "ctf_small_icon": ("탭 아이콘", "브라우저 탭에 표시할 32×32 PNG 아이콘입니다. 선택 사항입니다."),
    "ctf_theme": ("테마", "사이트의 화면 테마입니다. 나중에 바꿀 수 있습니다."),
    "theme_color": ("테마 색상", "지원되는 테마의 기본 색상을 설정합니다. 선택 사항입니다."),
    "start": ("대회 시작 시간", "대회 시작 시간을 설정합니다. 선택 사항입니다."),
    "end": ("대회 종료 시간", "대회 종료 시간을 설정합니다. 선택 사항입니다."),
    "social_shares": ("풀이 공유", "참가자가 문제를 풀었다는 링크를 공유할 수 있도록 허용합니다."),
}

_VISIBILITY_OPTIONS = {
    "Public": "전체 공개",
    "Private": "로그인한 참가자만",
    "Hidden": "숨김",
    "Admins Only": "관리자만",
    "MajorLeagueCyber Only": "MajorLeagueCyber 계정만",
}


def _select_labels(field, translations):
    """Keep WTForms option values and selected state while replacing the visible labels."""
    control = f'form.{field}(class="form-control custom-select")'
    display = "".join(
        f' | replace(">{english}<"|safe, ">{korean}<"|safe)'
        for english, korean in translations.items()
    )
    return f"{{{{ {control} }}}}", f"{{{{ {control}{display} }}}}"


TEXT = {
    "setup.html": {
        "Reset": "초기화",
        "UTC Preview": "협정 세계시(UTC) 미리보기",
        "MajorLeagueCyber Integration": "MajorLeagueCyber 연동",
        "MajorLeagueCyber (MLC) is a cyber security event tracker written and maintained by the developers of CTFd.":
            "MajorLeagueCyber(MLC)는 CTFd 개발팀이 운영하는 보안 대회 일정 서비스입니다.",
        "Setup": "설정하기",
    },
    "teams/private.html": {"Success!": "저장했습니다.", "Error:": "오류"},
    "teams/public.html": {"points": "점"},
    "users/private.html": {"points": "점"},
    "users/public.html": {"points": "점", "Solves": "풀이 기록"},
}


_ERROR_LABELS = {
    "Your username or password is incorrect": "아이디 또는 비밀번호가 올바르지 않습니다.",
    "That information is incorrect": "팀 이름 또는 팀 비밀번호가 올바르지 않습니다.",
    "You are already in a team. You cannot join another.": "이미 다른 팀에 소속되어 있습니다.",
    "That team name is already taken": "이미 사용 중인 팀 이름입니다.",
    "That team name is invalid": "올바른 팀 이름을 입력하세요.",
    "Please provide all required fields": "필수 항목을 모두 입력하세요.",
    "Please enter a valid email address": "올바른 이메일 주소를 입력하세요.",
    "That user name is already taken": "이미 사용 중인 아이디입니다.",
    "Your user name cannot be an email address": "아이디에 이메일 주소를 사용할 수 없습니다.",
    "That email has already been used": "이미 등록된 이메일 주소입니다.",
    "Pick a longer password": "더 긴 비밀번호를 입력하세요.",
    "Pick a shorter password": "더 짧은 비밀번호를 입력하세요.",
    "Pick a longer user name": "더 긴 아이디를 입력하세요.",
    "Websites must be a proper URL starting with http or https": "http 또는 https로 시작하는 주소를 입력하세요.",
    "Please provide a shorter affiliation": "소속을 더 짧게 입력하세요.",
    "Invalid country": "올바른 국가를 선택하세요.",
    "Please provide a valid bracket": "올바른 참가 부문을 선택하세요.",
}


REPLACEMENTS = {
    "setup.html": {
        **{f"{{{{ form.{field}.label }}}}": f'{{{{ form.{field}.label(text="{label}") }}}}'
           for field, (label, _) in _SETUP_FIELDS.items()},
        **{f"{{{{ form.{field}.description }}}}": description
           for field, (_, description) in _SETUP_FIELDS.items()},
        **dict(_select_labels(field, choices) for field, choices in {
            "challenge_visibility": _VISIBILITY_OPTIONS,
            "account_visibility": _VISIBILITY_OPTIONS,
            "score_visibility": _VISIBILITY_OPTIONS,
            "registration_visibility": {**_VISIBILITY_OPTIONS, "Private": "회원가입 닫기"},
            "verify_emails": {"Enabled": "필요", "Disabled": "불필요"},
            "social_shares": {"Enabled": "허용", "Disabled": "사용 안 함"},
        }.items()),
        "{{ radio.label }}": '{{ radio.label(text="팀전" if radio.data == "teams" else "개인전") }}',
        "{% trans %}UTC Preview{% endtrans %}": "협정 세계시(UTC) 미리보기",
    },
    "components/navbar.html": {
        'aria-label="Toggle navigation"': 'aria-label="메뉴 열기"',
        "{% trans %}Admin Panel{% endtrans %}": "관리자 메뉴",
        "{% trans %}Scoreboard{% endtrans %}": "점수판",
    },
    "components/errors.html": {
        'aria-label="Close"': 'aria-label="닫기"',
        "{{ info }}": (
            '{% if (info|string).startswith("Teams are limited to ") and (info|string).split()[4].isdigit() %}'
            '팀 정원은 최대 {{ (info|string).split()[4] }}명입니다.{% else %}{{ info }}{% endif %}'
        ),
        "{{ error }}": (
            '{% set team_limit = " has already reached the team size limit of " %}'
            '{% set parts = (error|string).rsplit(team_limit, 1) %}'
            '{% if parts|length == 2 and parts[1].isdigit() %}'
            '{{ parts[0] }} 팀은 정원 {{ parts[1] }}명이 모두 찼습니다.'
            '{% else %}{{ ' + repr(_ERROR_LABELS) + '.get(error|string, error) }}{% endif %}'
        ),
    },
    "teams/new_team.html": {
        "After creating your team, share the team name and password with your teammates so they can join your\n"
        "                  team.": "팀을 만든 뒤 팀 이름과 가입 비밀번호를 팀원에게 알려주면 같은 팀에 합류할 수 있습니다.",
    },
    "teams/team_enrollment.html": {
        "{% trans %}Welcome to{% endtrans %} {{ Configs.ctf_name }}!": "{{ Configs.ctf_name }}에 오신 것을 환영합니다!",
    },
    "teams/invite.html": {
        "{% trans %}Welcome to{% endtrans %} <strong>{{ team.name }}</strong>!":
            "<strong>{{ team.name }}</strong> 팀에 오신 것을 환영합니다!",
        "Or <a href=\"{{ url_for('teams.new') }}\">click here</a> if you'd prefer to create your own team.":
            "직접 만들려면 <a href=\"{{ url_for('teams.new') }}\">팀 만들기</a>를 눌러 주세요.",
    },
    "teams/private.html": {
        **_GRAPH_LABELS,
        'aria-label="Close"': 'aria-label="닫기"',
        'title="Edit Team"': 'title="팀 정보 수정"',
        'title="Choose Captain"': 'title="팀장 변경"',
        'title="Invite Users"': 'title="팀원 초대"',
        'title="Disband Team"': 'title="팀 해체"',
        'type="button" @click="copy()"': 'type="button" @click="copy()" aria-label="초대 링크 복사"',
        '{{ place }}\n            <small>{% trans %}place{% endtrans %}</small>': '{{ place[:-2] }}<small>위</small>',
        '{{ score }}\n          <small>{% trans %}points{% endtrans %}</small>': '{{ score }}<small>점</small>',
    },
    "teams/public.html": {
        **_GRAPH_LABELS,
        '{{ place }}\n            <small>place</small>': '{{ place[:-2] }}<small>위</small>',
    },
    "users/private.html": {
        **_GRAPH_LABELS,
        "{{ account.place }} <small>place</small>": "{{ account.place[:-2] }}<small>위</small>",
    },
    "users/public.html": {
        **_GRAPH_LABELS,
        "{{ account.place }} <small>place</small>": "{{ account.place[:-2] }}<small>위</small>",
    },
    "scoreboard.html": {
        "{% trans %}Place{% endtrans %}": "순위",
        "{{ get_mode_as_word(capitalize=True) }}": "{{ '팀' if Configs.user_mode == 'teams' else '참가자' }}",
    },
    "challenge.html": {
        'aria-label="Close"': 'aria-label="닫기"',
        '\n                  Submissions\n': '\n                  제출 기록\n',
        '{% trans %}Solution{% endtrans %}': '풀이 해설',
        '{% trans %}Rate this challenge:{% endtrans %}': '문제 평가',
        '{% trans %}Write a review (optional){% endtrans %}': '의견을 입력하세요(선택 사항)',
        '{% trans %}Thank you for your rating!{% endtrans %}': '평가를 남겨 주셔서 감사합니다.',
        '{% trans %}Submission{% endtrans %}': '제출 내용',
        '{% trans %}Type{% endtrans %}': '판정 결과',
        'data-bs-title="Copied!"': 'data-bs-title="복사했습니다."',
        '({{ ((ratings.up / (ratings.count)) * 100) | int }}% liked)':
            '(추천 {{ ((ratings.up / (ratings.count)) * 100) | int }}%)',
        '(Cost: {{ hint.cost }} point{{ hint.cost|pluralize }})': '({{ hint.cost }}점 필요)',
        'Unlock Hint for {{ hint.cost }} point{{ hint.cost|pluralize }}': '{{ hint.cost }}점으로 힌트 열기',
        'x-text="submission.type"':
            'x-text="({correct: \'정답\', incorrect: \'오답\', partial: \'부분 정답\'})[submission.type] ?? submission.type"',
        'x-text="response.data.message"': (
            'x-text="({\'Correct\': \'정답입니다.\', \'Incorrect\': \'오답입니다.\', '
            '\'Correct but more flags are required\': \'정답입니다. 추가 플래그를 제출해야 합니다.\', '
            '\'Correct but all team members must submit a flag\': \'정답입니다. 모든 팀원이 플래그를 제출해야 합니다.\', '
            '\'Correct but you already solved this\': \'이미 팀에서 해결한 문제입니다.\'})[response.data.message] '
            '?? response.data.message"'
        ),
    },
}
