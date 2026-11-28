(() => {
  const envelopeOrders = new Map([
    ["Lodge Warm-up", [4, 2, 3, 1, 5]],
    ["Web", [1, 5, 3, 2, 4]],
    ["Forensics", [4, 1, 3, 2, 5]],
    ["Misc", [5, 3, 2, 4, 1]],
  ]);
  const defaultEnvelopeOrder = [2, 5, 1, 4, 3];
  const envelopeMotifs = {
    1: { start: "holly-left", end: "holly-right", postmark: "green-postage" },
    2: { start: "bow", end: "mistletoe", postmark: "burgundy-postage" },
    3: { start: "moon-stars-corner", end: "compass", postmark: "navy-postmark" },
    4: { start: "pinecone-left", end: "pinecone-right", postmark: "walnut-postmark" },
    5: { start: "snowflake-left", end: "snowflake-right", postmark: "teal-postmark" },
  };

  document.addEventListener("alpine:init", () => {
    window.Alpine.data("ChallengeEnvelopeColors", (category) => ({
      envelopeColors: envelopeOrders.get(category) ?? defaultEnvelopeOrder,
      getEnvelopeMotifs(index, solved) {
        const color = solved ? 1 : this.envelopeColors[index % this.envelopeColors.length];
        return envelopeMotifs[color];
      },
    }));
  }, { once: true });

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
