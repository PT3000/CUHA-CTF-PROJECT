"""Korean interface labels for the CTFd 3.8.9 team administration templates."""

TEXT = {
    "admin/teams/teams.html": {
        "Teams": "팀 관리",
        "Team": "팀",
        "Country": "국가",
        "Hidden": "숨김",
        "Banned": "차단",
        "Official": "공식",
        "hidden": "숨김",
        "banned": "차단",
        "Page": "페이지",
    },
    "admin/teams/team.html": {
        "Edit Team": "팀 정보 수정",
        "Add Team Members": "팀원 추가 및 이동",
        "Team Invite": "팀 초대",
        "Team Statistics": "팀 통계",
        "Choose Captain": "팀장 변경",
        "Award Team Member": "팀원에게 보상 지급",
        "Member": "팀원",
        "IP Addresses": "IP 주소",
        "verified": "인증됨",
        "hidden": "숨김",
        "banned": "차단",
        "Official": "공식",
        "place": "위",
        "points": "점",
        "Team Members": "팀원",
        "User Name": "사용자 이름",
        "E-Mail": "이메일",
        "Score": "점수",
        "Captain": "팀장",
        "Solves": "정답 제출",
        "Fails": "오답 제출",
        "Awards": "보상",
        "Missing": "미해결 문제",
        "Challenge": "문제",
        "User": "제출자",
        "Submitted": "제출 플래그",
        "Category": "분류",
        "Value": "점수",
        "Time": "제출 시간",
        "Name": "이름",
        "Description": "설명",
        "Date": "지급 시간",
        "Icon": "아이콘",
        "Share this link for users to join this team": "팀에 합류할 참가자에게 이 링크를 공유하세요.",
    },
    "admin/teams/new.html": {"Create Team": "팀 만들기"},
    "admin/modals/teams/create.html": {"Optional": "선택 사항"},
    "admin/modals/teams/captain.html": {
        "Team Captain": "팀장",
        "Submit": "저장",
    },
    "admin/modals/teams/addresses.html": {
        "User": "사용자",
        "IP Address": "IP 주소",
        "Last Seen": "마지막 접속",
        "City": "도시",
        "Country": "국가",
        "IP Geolocation by DB-IP": "IP 위치 정보 제공 DB-IP",
    },
    "admin/modals/teams/statistics.html": {"No data yet": "표시할 통계가 아직 없습니다."},
    "admin/modals/awards/create.html": {
        "None": "없음",
        "Shield": "방패",
        "Bug": "버그",
        "Crown": "왕관",
        "Crosshairs": "조준 표시",
        "Ban": "금지 표시",
        "Lightning": "번개",
        "Skull": "해골",
        "Brain": "두뇌",
        "Code": "코드",
        "Cowboy": "카우보이 모자",
        "Angry": "화난 얼굴",
    },
}

TEAM_LABELS = {
    "{{ form.name.label }}": '{{ form.name.label(text="팀 이름") }}',
    "{{ form.email.label }}": '{{ form.email.label(text="이메일") }}',
    "{{ form.password.label }}": '{{ form.password.label(text="비밀번호") }}',
    "{{ form.website.label }}": '{{ form.website.label(text="웹사이트") }}',
    "{{ form.affiliation.label }}": '{{ form.affiliation.label(text="소속") }}',
    "{{ form.country.label }}": '{{ form.country.label(text="국가") }}',
    '{{ form.hidden.label(class="form-check-label") }}':
        '{{ form.hidden.label(text="숨김", class="form-check-label") }}',
    '{{ form.banned.label(class="form-check-label") }}':
        '{{ form.banned.label(text="차단", class="form-check-label") }}',
}

SEARCH_FIELDS = '{"name": "팀 이름", "id": "ID", "affiliation": "소속", "website": "웹사이트"}'
SEARCH_FORM = """{% set field_labels = """ + SEARCH_FIELDS + """ %}
                    <select name="{{ form.field.name }}" id="{{ form.field.id }}" class="form-control custom-select w-100" aria-label="검색 기준" required>
                        {% for value, label, selected in form.field.iter_choices() %}
                            <option value="{{ value }}"{% if selected %} selected{% endif %}>{{ field_labels.get(value, label) }}</option>
                        {% endfor %}
                    </select>"""

REPLACEMENTS = {
    "admin/teams/teams.html": {
        'title="Create Team"': 'title="팀 만들기"',
        'title="Edit Teams"': 'title="선택한 팀 수정"',
        'title="Delete Teams"': 'title="선택한 팀 삭제"',
        'placeholder="Search for matching teams"': 'placeholder="검색어 입력"',
        '{{ form.field(class="form-control custom-select w-100") }}': SEARCH_FORM,
        "Searching for teams with <strong>{{ field }}</strong> matching <strong>{{ q }}</strong>":
            "팀 검색 결과 <strong>{{ " + SEARCH_FIELDS + ".get(field, field) }}</strong> · <strong>{{ q }}</strong>",
        "Page {{ teams.page }} of {{ teams.total }} results":
            "검색 결과 {{ teams.total }}건 · {{ teams.page }}페이지",
    },
    "admin/teams/team.html": {
        'aria-label="Close"': 'aria-label="닫기"',
        "{{ form.link.label }}": '{{ form.link.label(text="초대 링크") }}',
        'title="Edit Team"': 'title="팀 정보 수정"',
        'title="Team Invite Link"': 'title="팀 초대 링크"',
        'title="Add Team Members"': 'title="팀원 추가 및 이동"',
        'title="Choose Captain"': 'title="팀장 변경"',
        'title="Award Team Member"': 'title="팀원에게 보상 지급"',
        'title="Delete Team"': 'title="팀 삭제"',
        'title="Team Statistics"': 'title="팀 통계"',
        'title="IP Addresses"': 'title="IP 주소"',
        'title="Remove {{ member.name }}"': 'title="{{ member.name }} 팀에서 제외"',
        "{{ members | length }} members": "팀원 {{ members | length }}명",
        "{{ place }}": "{{ place[:-2] }}",
    },
    "admin/modals/teams/edit.html": {
        **TEAM_LABELS,
        'form.submit(id="update-team", class="btn btn-primary btn-outlined float-right modal-action")':
            'form.submit(id="update-team", class="btn btn-primary btn-outlined float-right modal-action", value="저장")',
    },
    "admin/modals/teams/create.html": {
        **TEAM_LABELS,
        'form.submit(id="update-team", class="btn btn-primary btn-outlined float-right modal-action")':
            'form.submit(id="update-team", class="btn btn-primary btn-outlined float-right modal-action", value="팀 만들기")',
    },
    "admin/modals/awards/create.html": {
        "{{ form.name.label }}": '{{ form.name.label(text="보상 이름") }}',
        "{{ form.value.label }}": '{{ form.value.label(text="점수") }}',
        "{{ form.category.label }}": '{{ form.category.label(text="분류") }}',
        "{{ form.description.label }}": '{{ form.description.label(text="설명") }}',
        "{{ form.icon.label }}": '{{ form.icon.label(text="아이콘") }}',
        'form.submit(id="award-create-button", class="btn btn-primary")':
            'form.submit(id="award-create-button", class="btn btn-primary", value="보상 지급")',
    },
}
