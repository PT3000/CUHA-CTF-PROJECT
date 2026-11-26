"""CTFd page customization and asset registration."""

import re
from hashlib import sha256

from flask import redirect, request, url_for

from CTFd.models import Challenges, Teams, Users, db
from CTFd.plugins import (
    override_template,
    register_admin_plugin_stylesheet,
    register_plugin_asset,
    register_plugin_stylesheet,
    register_user_page_menu_bar,
)
from CTFd.utils.config import is_teams_mode

from .korean import SCORE_GRAPH_PAGES, register_korean_templates


ASSET_URL = "/plugins/christmas_tree/assets"


def _asset_revision(path):
    return sha256(path.read_bytes()).hexdigest()[:12]


def _register_script(app, assets, name, *, admins_only=False):
    filename = f"{name}.js"
    endpoint = f"christmas_tree_{name.replace('-', '_')}"
    register_plugin_asset(
        app, f"{ASSET_URL}/{filename}", admins_only=admins_only, endpoint=endpoint
    )
    revision = _asset_revision(assets / filename)
    return f"{{{{ url_for('{endpoint}', v='{revision}') }}}}"


def _template_source(app, name):
    return app.jinja_loader.get_source(app.jinja_env, name)[0]


def _prepend_scripts(source, *scripts, defer=False):
    attributes = " defer" if defer else ""
    tags = "".join(f'\n<script{attributes} src="{script}"></script>' for script in scripts)
    block = "{% block scripts %}"
    return source.replace(block, block + tags, 1)


def _redirect_home_to_challenges():
    if (
        request.endpoint == "views.static_html"
        and request.url_rule.rule == "/"
        and request.method in ("GET", "HEAD")
    ):
        return redirect(url_for("challenges.listing"))


def _submission_names(rows):
    # The stock listing joins for filtering, but doesn't load the related names.
    # Batch only the names used by this page after its native pagination.
    sources = {
        "user": (Users, "user_id"),
        "challenge": (Challenges, "challenge_id"),
    }
    if is_teams_mode():
        sources["team"] = (Teams, "team_id")

    names = {}
    for key, (model, id_attribute) in sources.items():
        ids = {getattr(row, id_attribute) for row in rows} - {None}
        names[key] = (
            dict(db.session.query(model.id, model.name).filter(model.id.in_(ids)).all())
            if ids else {}
        )
    names["account"] = names.pop("team", names["user"])
    return names


def _register_participant_templates(app, assets, site_templates, polling):
    navbar = "components/navbar.html"
    source = _template_source(app, f"core/{navbar}")
    source = re.sub(
        r'^[ \t]*<a\b[^>\n]*class="navbar-brand"[^>]*>.*?</a>[ \t]*\n',
        "",
        source,
        count=1,
        flags=re.MULTILINE | re.DOTALL,
    )
    source = re.sub(
        r'^[ \t]*<li class="nav-item dropdown">.*?<form x-data="LanguageForm">.*?</form>\s*</li>[ \t]*\n',
        "",
        source,
        count=1,
        flags=re.MULTILINE | re.DOTALL,
    )
    override_template(navbar, source)

    roster = (site_templates / "roster.html").read_text(encoding="utf-8")
    override_template("users/users.html", roster)
    override_template("teams/teams.html", roster)
    override_template("settings.html", (site_templates / "settings.html").read_text(encoding="utf-8"))

    setup = _template_source(app, "core/setup.html")
    override_template(
        "setup.html",
        setup.replace(
            'form.team_size(class="form-control custom-select")',
            'form.team_size(class="form-control custom-select", '
            'value=form.team_size.data if form.team_size.data is not none else 4)',
            1,
        ),
    )

    score_graph = _register_script(app, assets, "score-graph")
    for template in SCORE_GRAPH_PAGES:
        scripts = (polling, score_graph) if template == "scoreboard.html" else (score_graph,)
        source = f"""
{{% extends "core/{template}" %}}
{{% block scripts %}}
  {{{{ super() }}}}
{{% endblock %}}
"""
        override_template(template, _prepend_scripts(source, *scripts))

    challenge_live = _register_script(app, assets, "challenge-live")
    challenges = _template_source(app, "core/challenges.html").replace(
        '<div class="jumbotron">',
        '<div class="jumbotron">\n'
        '    <div class="challenge-room-window" aria-hidden="true">\n'
        '      <div class="challenge-room-snow"></div>\n'
        '    </div>\n'
        '    <div class="challenge-room-trim" aria-hidden="true">\n'
        '      <div class="challenge-room-sill-props">\n'
        '        <span class="challenge-room-candle"></span><span class="challenge-room-mug"></span>\n'
        '      </div>\n'
        '    </div>\n'
        '    <div class="challenge-room-garland" aria-hidden="true"></div>',
        1,
    ).replace(
        '</h1>',
        '</h1>\n'
        '      <div class="challenge-room-stockings" aria-hidden="true">\n'
        '        <span></span><span></span><span><i aria-hidden="true"></i></span>\n'
        '      </div>',
        1,
    ).replace(
        '<span x-text="c.value"></span>',
        '<span x-text="c.value"></span>\n'
        '                        <template x-if="c.solved_by_me">\n'
        '                          <small class="d-block pt-1 fw-semibold">해결됨</small>\n'
        '                        </template>',
        1,
    )
    override_template("challenges.html", _prepend_scripts(challenges, polling, challenge_live))


def _register_admin_templates(app, site_templates):
    submissions = "admin/submissions.html"
    app.add_template_global(_submission_names, "get_submission_names")
    source = (
        _template_source(app, submissions)
        .replace(
            "{% for sub in submissions.items %}",
            "{% set submission_names = get_submission_names(submissions.items) %}"
            "{% for sub in submissions.items %}",
        )
        .replace("sub.user.name", "submission_names.user.get(sub.user_id, '')")
        .replace("sub.account.name", "submission_names.account.get(sub.account_id, '')")
        .replace("sub.challenge.name", "submission_names.challenge.get(sub.challenge_id, '')")
    )
    override_template(submissions, source)
    override_template(
        "admin/statistics.html",
        (site_templates / "admin-statistics.html").read_text(encoding="utf-8"),
    )
    admin_base = "admin/base.html"
    override_template(
        admin_base,
        _template_source(app, admin_base).replace(
            'class="navbar-brand">CTFd</a>',
            'class="navbar-brand">{{ Configs.ctf_name }}</a>',
        ),
    )


def _register_admin_scripts(app, assets):
    submissions = _register_script(app, assets, "submission-live", admins_only=True)
    team = _register_script(app, assets, "team-admin-ko", admins_only=True)
    actions = _register_script(app, assets, "admin-actions-ko", admins_only=True)
    scripts_by_template = {
        "admin/teams/team.html": (team,),
        "admin/teams/teams.html": (team,),
        "admin/config.html": (actions,),
        "admin/submissions.html": (actions, submissions),
        "admin/challenges/challenge.html": (actions,),
    }
    for template, scripts in scripts_by_template.items():
        source = _template_source(app, template)
        override_template(template, _prepend_scripts(source, *scripts, defer=True))


def register_site(app, assets):
    register_user_page_menu_bar("크리스마스 트리", "christmas-tree/")

    theme_styles = f"{ASSET_URL}/theme.css"
    register_plugin_asset(app, theme_styles)
    styles = f"{theme_styles}?v={_asset_revision(assets / 'theme.css')}"
    register_plugin_stylesheet(styles)
    register_admin_plugin_stylesheet(styles)
    app.before_request(_redirect_home_to_challenges)

    site_templates = assets.parent / "templates" / "site"
    polling = _register_script(app, assets, "visible-polling")
    _register_participant_templates(app, assets, site_templates, polling)
    _register_admin_templates(app, site_templates)
    register_korean_templates(app)
    _register_admin_scripts(app, assets)
