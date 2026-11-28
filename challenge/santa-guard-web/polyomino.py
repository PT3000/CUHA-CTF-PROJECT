"""Parcel shapes, warehouse floors, and placement rules for the sorting game."""

# Shape diagrams use # for a square occupied by the parcel.
_PARCELS = {
    "box": ("선물 상자", ("##", "##")),
    "cane": ("지팡이 사탕", ("##", ".#", ".#")),
    "stocking": ("선물 양말", ("..#", "###")),
    "skis": ("스키", ("####",)),
    "train": ("장난감 기차", ("#.", "#.", "#.", "##")),
    "tree": ("미니 트리", ("###", ".#.", ".#.")),
    "rails": ("기차 레일", ("#..", "#..", "###")),
    "lights": ("꼬마 전구", ("#..", "##.", ".##")),
    "antlers": ("순록 머리띠", (".#", "##", ".#", ".#")),
    "bear": ("곰 인형", ("##", "##", "#.")),
    "earmuffs": ("귀마개", ("#.#", "###")),
    "bell": ("은방울", ("###", ".#.")),
    "boot": ("털 부츠", ("#.", "#.", "##")),
    "sled": ("작은 썰매", (".#", ".#", "##")),
    "scarf": ("목도리", (".#", ".#", "##", "#.")),
    "ribbon": ("금빛 리본", ("##.", ".##")),
}


def _cells(rows, symbol):
    return [[x, y] for y, row in enumerate(rows) for x, cell in enumerate(row) if cell == symbol]


def _level(rows, *parcel_ids):
    # On floor plans, . is usable floor, # is a fixed crate and - is outside.
    pieces = []
    for parcel_id in parcel_ids:
        name, shape = _PARCELS[parcel_id]
        pieces.append({"id": parcel_id, "name": name, "cells": _cells(shape, "#")})
    return {
        "size": len(rows),
        "blocked": _cells(rows, "#"),
        "outside": _cells(rows, "-"),
        "pieces": pieces,
    }


LEVELS = (
    _level(("....",) * 4, "box", "cane", "stocking", "skis"),
    _level((".....",) * 5, "train", "tree", "rails", "lights", "antlers"),
    _level(
        ("......", "..#...", "......", "....#.", ".#....", "....#."),
        "bear", "earmuffs", "lights", "antlers", "bell", "boot", "sled",
    ),
    _level(
        ("--....-", "-.....-", "......-", ".......", ".......", "-......", "-....--"),
        "bear", "scarf", "tree", "earmuffs", "rails", "lights", "antlers", "ribbon",
    ),
)


def _rotated_cells(cells, rotation):
    for _ in range(rotation):
        cells = [(-y, x) for x, y in cells]
    left = min(x for x, _ in cells)
    top = min(y for _, y in cells)
    return [(x - left, y - top) for x, y in cells]


def validate_layout(level, layout):
    """Return whether every placed parcel is in bounds, on empty floor and disjoint."""
    if not isinstance(layout, dict) or len(layout) > len(level["pieces"]):
        return False
    shapes = {piece["id"]: piece["cells"] for piece in level["pieces"]}
    occupied = {tuple(cell) for cell in level["blocked"] + level["outside"]}
    size = level["size"]
    for piece_id, position in layout.items():
        if piece_id not in shapes or not isinstance(position, dict) or position.keys() != {"x", "y", "rotation"}:
            return False
        x, y, rotation = position["x"], position["y"], position["rotation"]
        if any(type(value) is not int for value in (x, y, rotation)) or not 0 <= rotation < 4:
            return False
        for dx, dy in _rotated_cells(shapes[piece_id], rotation):
            col, row = x + dx, y + dy
            if not (0 <= col < size and 0 <= row < size) or (col, row) in occupied:
                return False
            occupied.add((col, row))
    return True


def is_complete(level, layout):
    """Require every parcel to be placed and every usable square to be covered."""
    if not validate_layout(level, layout) or len(layout) != len(level["pieces"]):
        return False
    floor_area = level["size"] ** 2 - len(level["blocked"]) - len(level["outside"])
    return sum(len(piece["cells"]) for piece in level["pieces"]) == floor_area
