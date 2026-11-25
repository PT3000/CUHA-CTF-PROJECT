FROM ghcr.io/ctfd/ctfd:3.8.9

COPY --chown=1001:1001 ctfd_tree.py /opt/CTFd/CTFd/plugins/christmas_tree/__init__.py
COPY --chown=1001:1001 ctfd_tree_judging.py /opt/CTFd/CTFd/plugins/christmas_tree/judging.py
COPY --chown=1001:1001 ctfd_tree_judging.html /opt/CTFd/CTFd/plugins/christmas_tree/templates/ctfd_tree_judging.html
COPY --chown=1001:1001 index.html demo.css demo.js scene-export.js *.png *.jpg /opt/CTFd/CTFd/plugins/christmas_tree/assets/
