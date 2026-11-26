"""Batch-load challenge tags in the CTFd 3.8.9 challenge listing."""

import sys
from pathlib import Path


def patch_challenge_tags(root):
    path = root / "CTFd" / "utils" / "challenges" / "__init__.py"
    source = path.read_text(encoding="utf-8")
    imports = "from sqlalchemy.sql import and_, false, true\n"
    listing = (
        '    filters = build_model_filters(model=Challenges, query=q, field=field)\n'
        '    chal_q = Challenges.query\n'
    )
    if source.count(imports) != 1 or source.count(listing) != 1:
        raise RuntimeError("CTFd challenge listing differs from the expected 3.8.9 source")

    eager_listing = listing.replace(
        "chal_q = Challenges.query",
        "chal_q = Challenges.query.options(selectinload(Challenges.tags))",
    )
    source = source.replace(imports, "from sqlalchemy.orm import selectinload\n" + imports, 1)
    source = source.replace(listing, eager_listing, 1)
    path.write_text(source, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    patch_challenge_tags(Path(sys.argv[1]))
