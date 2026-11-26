(() => {
  document.addEventListener("alpine:initialized", () => {
    const element = document.querySelector('[x-data="ChallengeBoard"]');
    if (!element) return;

    const board = window.Alpine.$data(element);
    const loadChallenges = board.loadChallenges.bind(board);
    let nativeLoads = 0;

    const abortRefresh = window.startVisiblePoll({
      element,
      url: "/api/v1/challenges",
      shouldRefresh: () => board.loaded && !nativeLoads,
      onData(data) {
        const challenges = window.CTFd._functions?.challenges?.sortChallenges?.(data) ?? data;
        if (JSON.stringify(challenges) !== JSON.stringify(board.challenges)) {
          board.challenges = challenges;
        }
      },
    });

    // A post-submission refresh takes priority over a background snapshot.
    board.loadChallenges = async () => {
      abortRefresh();
      nativeLoads += 1;
      try {
        return await loadChallenges();
      } finally {
        nativeLoads -= 1;
      }
    };
  }, { once: true });
})();
