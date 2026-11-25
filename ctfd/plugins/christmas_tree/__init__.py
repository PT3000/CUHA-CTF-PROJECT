"""CTFd plugin for the team Christmas tree event."""

import json
import os
import re
from collections import Counter
from copy import deepcopy
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from secrets import choice

from flask import (
    Blueprint,
    abort,
    current_app,
    jsonify,
    redirect,
    request,
    send_from_directory,
    session,
    url_for,
)
from sqlalchemy.exc import IntegrityError

from CTFd.models import Challenges, Solves, Teams, db
from CTFd.plugins import register_user_page_menu_bar
from CTFd.utils.config import is_teams_mode
from CTFd.utils.user import get_current_user, is_verified


ASSETS = Path(__file__).resolve().with_name("assets")
GIFT_ORNAMENT_IDS = ("1", "2", "3", "4", "5")
CORD_IDS = {"8", "9"}
DEMO_GROWTH_THRESHOLDS = (0, 3, 6, 10, 15)
MAX_PLACEMENTS = 256
MAX_ACTION_BYTES = 96 * 1024
ASSET_REFERENCE = re.compile(r"\./([a-z][a-z0-9-]*\.(?:css|js)|images/[a-z][a-z0-9-]*\.(?:png|jpg))")
blueprint = Blueprint("christmas_tree", __name__, url_prefix="/christmas-tree")


class TreeState(db.Model):
    __tablename__ = "christmas_tree_state"

    team_id = db.Column(db.Integer, db.ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    revision = db.Column(db.Integer, nullable=False, default=0)
    snapshot = db.Column(db.JSON, nullable=False)


@dataclass(frozen=True)
class ShopItem:
    price: int
    ornament_id: str | None
    effect: str | None
    limit: int | None


class TreeCatalogue(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.items = {}
        self.assets = set()
        self.feed(markup)
        self.close()
        self.ornaments = {item.ornament_id for item in self.items.values() if item.ornament_id}
        self.effects = {item.effect for item in self.items.values() if item.effect}
        if not set(GIFT_ORNAMENT_IDS + ("10",)).union(CORD_IDS) <= self.ornaments:
            raise ValueError("The Christmas tree catalogue is missing ornaments used by the game.")

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        for key, value in attrs:
            if value and (key in ("src", "href") or key.startswith("data-growth-")):
                match = ASSET_REFERENCE.fullmatch(value)
                if match:
                    self.assets.add(match[1])

        if "data-shop-id" in attributes:
            item_id = attributes["data-shop-id"]
            price = int(attributes["data-price"])
            ornament_id = attributes.get("data-ornament-id")
            effect = attributes.get("data-effect")
            limit = int(attributes["data-limit"]) if "data-limit" in attributes else None
            if item_id in self.items or price <= 0 or bool(ornament_id) == bool(effect):
                raise ValueError(f"Invalid Christmas tree catalogue entry: {item_id}")
            self.items[item_id] = ShopItem(price, ornament_id, effect, limit)


@dataclass(frozen=True)
class TreeSettings:
    catalogue: TreeCatalogue
    challenge_ids: frozenset[int]
    starting_points: int
    points_per_solve: int


class TreeError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def _settings():
    return current_app.extensions["christmas_tree"]


def _integer_setting(name, default):
    value = int(os.environ.get(name, default))
    if value < 0:
        raise ValueError(f"{name} must be a non-negative integer.")
    return value


def _team_identity():
    user = get_current_user()
    if user is None:
        raise TreeError("CTFd에 로그인해 주세요.", 401)
    if not is_teams_mode():
        raise TreeError("트리 꾸미기는 CTFd 팀 모드에서 이용할 수 있어요.", 403)
    if user.banned or not is_verified():
        raise TreeError("이 계정으로 트리 꾸미기를 이용할 수 없어요.", 403)
    if user.team is None:
        raise TreeError("CTFd에서 팀에 먼저 가입해 주세요.", 403)
    if user.team.banned:
        raise TreeError("이 팀은 트리 꾸미기를 이용할 수 없어요.", 403)
    return user.team.id, user.team.name


def _review_identity():
    user = get_current_user()
    if user is None:
        raise TreeError("CTFd에 로그인해 주세요.", 401)
    if user.type != "admin" or user.banned:
        raise TreeError("운영진만 다른 팀의 트리를 볼 수 있어요.", 403)
    team_id = request.args.get("review_team", type=int)
    team = Teams.query.filter_by(id=team_id, hidden=False, banned=False).one_or_none()
    if team is None:
        raise TreeError("심사할 팀을 찾을 수 없어요.", 404)
    return team.id, team.name


def _initial_snapshot(points):
    return {
        "points": points,
        "inventory": {},
        "purchasedEffects": [],
        "activeEffects": [],
        "pendingGifts": 0,
        "placements": [],
        "growth": 1,
        "layoutVersion": 0,
        "rewardedChallengeIds": [],
    }


def _confirmed_solves(team_id, challenge_ids):
    eligible = db.session.query(Challenges.id).filter(Challenges.state == "visible")
    if challenge_ids:
        eligible = eligible.filter(Challenges.id.in_(challenge_ids))
    total = eligible.count()
    confirmed = db.session.query(Solves.challenge_id).filter(
        Solves.team_id == team_id,
        Solves.challenge_id.in_(eligible.statement),
    )
    return {challenge_id for (challenge_id,) in confirmed}, total


def _growth_thresholds(total):
    if total == 0:
        return list(DEMO_GROWTH_THRESHOLDS)
    return [(total * threshold + 14) // 15 for threshold in DEMO_GROWTH_THRESHOLDS]


def _reconcile_solves(snapshot, confirmed, thresholds, points_per_solve):
    rewarded = set(snapshot["rewardedChallengeIds"])
    new_ids = confirmed - rewarded
    if new_ids:
        snapshot["rewardedChallengeIds"] = sorted(rewarded | new_ids)
        snapshot["points"] += len(new_ids) * points_per_solve
        snapshot["pendingGifts"] += len(new_ids)

    maximum_growth = sum(threshold <= len(confirmed) for threshold in thresholds)
    if snapshot["growth"] > maximum_growth:
        snapshot["growth"] = maximum_growth
        snapshot["layoutVersion"] += 1


def _purchase(snapshot, payload, catalogue):
    item_id = payload.get("item")
    item = catalogue.items.get(item_id) if isinstance(item_id, str) else None
    if not item:
        raise TreeError("상점에 없는 상품이에요.")

    inventory = snapshot["inventory"]
    count = inventory.get(item.ornament_id, 0)
    if item.limit is not None and count >= item.limit:
        raise TreeError("이 장식은 최대 보유 수량에 도달했어요.", 409)
    if item.effect and item.effect in snapshot["purchasedEffects"]:
        raise TreeError("이미 구매한 배경이에요.", 409)
    if item.price > snapshot["points"]:
        raise TreeError("구매 포인트가 부족해요.", 409)

    snapshot["points"] -= item.price
    if item.ornament_id:
        inventory[item.ornament_id] = count + 1
    else:
        snapshot["purchasedEffects"].append(item.effect)


def _toggle_effect(snapshot, payload, catalogue):
    effect = payload.get("effect")
    active = payload.get("active")
    if not isinstance(effect, str) or effect not in catalogue.effects or type(active) is not bool:
        raise TreeError("배경 선택이 올바르지 않아요.")
    if effect not in snapshot["purchasedEffects"]:
        raise TreeError("먼저 배경을 구매해 주세요.", 409)
    active_effects = set(snapshot["activeEffects"])
    if active:
        active_effects.add(effect)
    else:
        active_effects.discard(effect)
    snapshot["activeEffects"] = sorted(active_effects)


def _open_gift(snapshot):
    if snapshot["pendingGifts"] < 1:
        raise TreeError("열 수 있는 선물이 없어요.", 409)
    inventory = snapshot["inventory"]
    available = [ornament for ornament in GIFT_ORNAMENT_IDS if ornament not in inventory]
    snapshot["pendingGifts"] -= 1
    if available:
        ornament = choice(available)
        inventory[ornament] = 1
        return {"ornamentId": ornament}
    snapshot["points"] += 300
    return {"points": 300}


def _coordinate(placement, key):
    value = placement.get(key)
    if type(value) not in (int, float) or not 0 <= value <= 1:
        raise TreeError("장식 좌표는 트리 화면 안에 있어야 해요.")
    return value


def _save_layout(snapshot, payload, catalogue, maximum_growth):
    version = payload.get("layoutVersion")
    if type(version) is not int or version != snapshot["layoutVersion"]:
        raise TreeError("다른 팀원이 트리를 먼저 저장했어요. 최신 배치를 확인해 주세요.", 409)

    growth = payload.get("growth")
    placements = payload.get("placements")
    if type(growth) is not int or not 1 <= growth <= maximum_growth:
        raise TreeError("지금 선택할 수 없는 트리 단계예요.")
    if not isinstance(placements, list) or len(placements) > MAX_PLACEMENTS:
        raise TreeError(f"장식은 최대 {MAX_PLACEMENTS}개까지 놓을 수 있어요.")

    validated = []
    counts = Counter()
    for placement in placements:
        if not isinstance(placement, dict):
            raise TreeError("장식 배치 데이터가 올바르지 않아요.")
        ornament = placement.get("ornamentId")
        size = placement.get("size")
        if not isinstance(ornament, str) or ornament not in catalogue.ornaments:
            raise TreeError("알 수 없는 장식이에요.")
        if type(size) is not int or size not in range(30, 161, 10):
            raise TreeError("장식 크기는 30%에서 160%까지 10% 단위로 설정할 수 있어요.")

        counts[ornament] += 1
        if counts[ornament] > snapshot["inventory"].get(ornament, 0):
            raise TreeError("보유 수량보다 많이 배치할 수 없어요.")
        entry = {
            "ornamentId": ornament,
            "x": _coordinate(placement, "x"),
            "y": _coordinate(placement, "y"),
            "size": size,
        }
        if ornament in CORD_IDS:
            entry["startX"] = _coordinate(placement, "startX")
            entry["startY"] = _coordinate(placement, "startY")
        if ornament == "10":
            color = placement.get("presentColor", 0)
            if type(color) is not int or color not in range(5):
                raise TreeError("선물 상자 색상이 올바르지 않아요.")
            entry["presentColor"] = color
        validated.append(entry)

    if validated != snapshot["placements"] or growth != snapshot["growth"]:
        snapshot["placements"] = validated
        snapshot["growth"] = growth
        snapshot["layoutVersion"] += 1


def _apply_action(snapshot, payload, catalogue, maximum_growth):
    action = payload.get("action")
    if action == "purchase":
        _purchase(snapshot, payload, catalogue)
    elif action == "toggle-effect":
        _toggle_effect(snapshot, payload, catalogue)
    elif action == "open-gift":
        return _open_gift(snapshot)
    elif action == "save-layout":
        _save_layout(snapshot, payload, catalogue, maximum_growth)
    else:
        raise TreeError("알 수 없는 트리 작업이에요.")


def _json(payload, status=200):
    response = jsonify(payload)
    response.headers["Cache-Control"] = "no-store"
    return response, status


def _serialize(snapshot, confirmed, total, thresholds, team_name, read_only=False):
    state = {key: value for key, value in snapshot.items() if key != "rewardedChallengeIds"}
    state.update(
        solved=len(confirmed),
        total=total,
        growthThresholds=thresholds,
        maxPlacements=MAX_PLACEMENTS,
        csrfToken=session.get("nonce"),
        challengeUrl=url_for("challenges.listing"),
        teamName=team_name,
        readOnly=read_only,
    )
    return state


def _review_state():
    try:
        team_id, team_name = _review_identity()
    except TreeError as error:
        return _json({"error": str(error)}, error.status)

    settings = _settings()
    row = TreeState.query.filter_by(team_id=team_id).one_or_none()
    snapshot = deepcopy(row.snapshot) if row else _initial_snapshot(settings.starting_points)
    confirmed, total = _confirmed_solves(team_id, settings.challenge_ids)
    thresholds = _growth_thresholds(total)
    _reconcile_solves(snapshot, confirmed, thresholds, settings.points_per_solve)
    return _json({"state": _serialize(snapshot, confirmed, total, thresholds, team_name, read_only=True)})


def _team_request(payload=None):
    try:
        team_id, team_name = _team_identity()
    except TreeError as error:
        return _json({"error": str(error)}, error.status)

    settings = _settings()
    for _ in range(3):
        # Lock the existing parent row first. Concurrent initializers never compete for a missing state row.
        locked_team = (
            db.session.query(Teams.id)
            .filter_by(id=team_id, banned=False)
            .with_for_update()
            .one_or_none()
        )
        if locked_team is None:
            db.session.rollback()
            return _json({"error": "이 팀은 트리 꾸미기를 이용할 수 없어요."}, 403)
        row = TreeState.query.filter_by(team_id=team_id).with_for_update().one_or_none()
        snapshot = deepcopy(row.snapshot) if row else _initial_snapshot(settings.starting_points)
        confirmed, total = _confirmed_solves(team_id, settings.challenge_ids)
        thresholds = _growth_thresholds(total)
        _reconcile_solves(snapshot, confirmed, thresholds, settings.points_per_solve)

        error = reward = None
        if payload is not None:
            try:
                maximum_growth = sum(threshold <= len(confirmed) for threshold in thresholds)
                reward = _apply_action(snapshot, payload, settings.catalogue, maximum_growth)
            except TreeError as caught:
                error = caught

        try:
            if row is None:
                db.session.add(TreeState(team_id=team_id, snapshot=snapshot))
            elif snapshot != row.snapshot:
                updated = TreeState.query.filter_by(team_id=team_id, revision=row.revision).update(
                    {TreeState.snapshot: snapshot, TreeState.revision: row.revision + 1},
                    synchronize_session=False,
                )
                if updated != 1:
                    db.session.rollback()
                    continue
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            if row is None:
                # Two requests can race to initialize the same team before its row exists.
                continue
            raise

        state = _serialize(snapshot, confirmed, total, thresholds, team_name)
        if error:
            return _json({"state": state, "error": str(error)}, error.status)
        if reward is not None:
            return _json({"state": state, "reward": reward})
        return _json({"state": state})

    return _json({"error": "팀 트리가 갱신 중이에요. 잠시 후 다시 시도해 주세요."}, 409)


@blueprint.get("/")
def page():
    reviewing = "review_team" in request.args
    try:
        if reviewing:
            _review_identity()
        else:
            _team_identity()
    except TreeError as error:
        if error.status == 401:
            return redirect(url_for("auth.login", next=request.full_path))
        if not reviewing and is_teams_mode():
            user = get_current_user()
            if user and user.team is None and not user.banned and is_verified():
                return redirect(url_for("teams.private", next=request.path))
        abort(error.status, description=str(error))
    return send_from_directory(ASSETS, "index.html", max_age=0)


@blueprint.get("/<path:name>")
def asset(name):
    if name not in _settings().catalogue.assets:
        abort(404)
    return send_from_directory(ASSETS, name, max_age=300)


@blueprint.get("/api/state")
def state():
    if "review_team" in request.args:
        return _review_state()
    return _team_request()


@blueprint.post("/api/action")
def action():
    if "review_team" in request.args:
        return _json({"error": "심사 미리보기에서는 트리를 수정할 수 없어요."}, 403)
    if not request.is_json:
        return _json({"error": "JSON 요청을 보내 주세요."}, 415)
    if request.content_length is not None and request.content_length > MAX_ACTION_BYTES:
        return _json({"error": "저장할 장식 데이터가 너무 커요."}, 413)
    body = request.stream.read(MAX_ACTION_BYTES + 1)
    if len(body) > MAX_ACTION_BYTES:
        return _json({"error": "저장할 장식 데이터가 너무 커요."}, 413)
    try:
        payload = json.loads(body)
    except (ValueError, RecursionError):
        return _json({"error": "트리 작업을 읽을 수 없어요."}, 400)
    if not isinstance(payload, dict):
        return _json({"error": "트리 작업을 읽을 수 없어요."}, 400)
    return _team_request(payload)


def load(app):
    catalogue = TreeCatalogue((ASSETS / "index.html").read_text(encoding="utf-8"))
    missing = {name for name in catalogue.assets if not (ASSETS / name).is_file()}
    if missing:
        raise ValueError(f"Missing Christmas tree assets: {', '.join(sorted(missing))}")

    raw_ids = os.environ.get("CHRISTMAS_TREE_CHALLENGE_IDS", "")
    challenge_ids = frozenset(int(value.strip()) for value in raw_ids.split(",") if value.strip())
    if any(challenge_id <= 0 for challenge_id in challenge_ids):
        raise ValueError("CHRISTMAS_TREE_CHALLENGE_IDS requires positive challenge IDs.")

    app.extensions["christmas_tree"] = TreeSettings(
        catalogue,
        challenge_ids,
        _integer_setting("CHRISTMAS_TREE_STARTING_POINTS", 30000),
        _integer_setting("CHRISTMAS_TREE_POINTS_PER_SOLVE", 500),
    )
    TreeState.__table__.create(bind=db.engine, checkfirst=True)
    app.register_blueprint(blueprint)
    register_user_page_menu_bar("크리스마스 트리", "christmas-tree/")

    from .judging import register_judging

    register_judging(app)
