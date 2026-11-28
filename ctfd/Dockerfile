FROM ghcr.io/ctfd/ctfd:3.8.9

COPY --chown=1001:1001 patches/eager_challenge_tags.py /tmp/eager_challenge_tags.py
RUN python /tmp/eager_challenge_tags.py /opt/CTFd

COPY --chown=1001:1001 plugins/christmas_tree/ /opt/CTFd/CTFd/plugins/christmas_tree/
