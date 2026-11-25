import os
from fractions import Fraction

from flask import Blueprint, abort, current_app, redirect, render_template, request, session, url_for

from CTFd.models import Teams, Users, db
from CTFd.plugins import register_admin_plugin_menu_bar
from CTFd.utils.config import is_teams_mode
from CTFd.utils.decorators import admins_only
from CTFd.utils.scores import get_standings
from CTFd.utils.user import get_current_user


judging = Blueprint("christmas_tree_judging", __name__, url_prefix="/christmas-tree/judging")
weight_key = "CHRISTMAS_TREE_ART_WEIGHT"


class TreeVote(db.Model):
    __tablename__ = "christmas_tree_votes"
    __table_args__ = (db.CheckConstraint("score BETWEEN 0 AND 100", name="tree_vote_score_range"),)

    judge_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    score = db.Column(db.Integer, nullable=False)


def eligible_teams():
    return Teams.query.filter_by(hidden=False, banned=False)


def judging_rows(teams, judge_id, art_weight):
    scoreboard = {standing.account_id: int(standing.score) for standing in get_standings(admin=True)}
    vote_totals = {
        team_id: (int(total), int(count))
        for team_id, total, count in db.session.query(
            TreeVote.team_id, db.func.sum(TreeVote.score), db.func.count(TreeVote.score)
        ).group_by(TreeVote.team_id)
    }
    own_votes = {
        vote.team_id: vote.score for vote in TreeVote.query.filter_by(judge_id=judge_id)
    }
    averages = {
        team.id: Fraction(*vote_totals[team.id]) for team in teams if team.id in vote_totals
    }
    art_ranks = {}
    for rank, average in enumerate(sorted(averages.values(), reverse=True), 1):
        art_ranks.setdefault(average, rank)
    maximum_score = max((max(0, scoreboard.get(team.id, 0)) for team in teams), default=0)
    rows = []
    for team in teams:
        raw_score = scoreboard.get(team.id, 0)
        solve_points = Fraction(max(raw_score, 0) * (100 - art_weight), maximum_score or 1)
        art_rank = art_ranks.get(averages.get(team.id))
        art_points = Fraction()
        if art_rank is not None:
            art_points = Fraction((len(averages) - art_rank + 1) * art_weight, len(averages))
        rows.append({
            "team": team,
            "score": raw_score,
            "solve_points": float(solve_points),
            "art_points": float(art_points),
            "art_average": float(averages[team.id]) if team.id in averages else None,
            "art_rank": art_rank,
            "vote_count": vote_totals.get(team.id, (0, 0))[1],
            "own_vote": own_votes.get(team.id),
            "total": solve_points + art_points,
        })
    rows.sort(key=lambda row: (-row["total"], -row["score"], row["team"].id))
    last_key = None
    for position, row in enumerate(rows, 1):
        key = row["total"], row["score"]
        if key != last_key:
            rank = position
        row["rank"] = rank
        row["total"] = float(row["total"])
        last_key = key
    return rows


@judging.get("/")
@admins_only
def standings():
    if not is_teams_mode():
        abort(409, description="CTFd 팀 모드에서 트리 심사를 사용할 수 있습니다.")
    art_weight = current_app.config[weight_key]
    rows = judging_rows(eligible_teams().all(), get_current_user().id, art_weight)
    return render_template(
        "plugins/christmas_tree/templates/ctfd_tree_judging.html",
        rows=rows,
        art_weight=art_weight,
        solve_weight=100 - art_weight,
        nonce=session.get("nonce", ""),
        saved=request.args.get("saved", type=int),
    ), 200, {"Cache-Control": "no-store"}


@judging.post("/vote")
@admins_only
def vote():
    if not is_teams_mode():
        abort(409)
    team_id = request.form.get("team_id", type=int)
    score = request.form.get("score", type=int)
    if score is None or not 0 <= score <= 100:
        abort(400, description="심사 점수는 0~100 사이의 정수여야 합니다.")
    eligible_teams().filter_by(id=team_id).first_or_404()

    judge_id = get_current_user().id
    # Serialize repeat submissions from the same judge across workers.
    db.session.query(Users.id).filter_by(id=judge_id).with_for_update().one()
    ballot = db.session.get(TreeVote, (judge_id, team_id))
    if ballot is None:
        ballot = TreeVote(judge_id=judge_id, team_id=team_id)
        db.session.add(ballot)
    ballot.score = score
    db.session.commit()
    return redirect(url_for(".standings", saved=team_id), code=303)


def register_judging(app):
    try:
        art_weight = int(os.environ.get(weight_key, "20"))
    except ValueError as error:
        raise ValueError(f"{weight_key} must be an integer from 0 to 100.") from error
    if not 0 <= art_weight <= 100:
        raise ValueError(f"{weight_key} must be an integer from 0 to 100.")
    app.config[weight_key] = art_weight
    TreeVote.__table__.create(bind=db.engine, checkfirst=True)
    app.register_blueprint(judging)
    register_admin_plugin_menu_bar("트리 심사", "/christmas-tree/judging/")
