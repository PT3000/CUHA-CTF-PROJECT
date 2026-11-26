(() => {
  const standingsElement = document.getElementById("scoreboard");
  if (standingsElement) {
    document.addEventListener("alpine:initialized", () => {
      const standings = window.Alpine.$data(standingsElement);
      const graph = window.Alpine.$data(document.getElementById("score-graph"));
      window.startVisiblePoll({
        element: standingsElement,
        url: "/api/v1/scoreboard",
        async onData(data) {
          if (JSON.stringify(data) !== JSON.stringify(standings.standings)) {
            standings.standings = data;
            await graph.update();
          }
        },
      });
    }, { once: true });
  }

  function formatScores(points) {
    const tooltip = document.createElement("div");
    for (const { seriesName, value } of points) {
      const row = document.createElement("div");
      const score = Array.isArray(value) ? value[1] : value;
      row.textContent = `${seriesName} · ${score}점`;
      tooltip.append(row);
    }
    return tooltip;
  }

  function scoreGraphOptions(title) {
    return {
      title: { text: title },
      xAxis: [{ axisLabel: { show: false } }],
      tooltip: {
        axisPointer: { type: "line", label: { show: false } },
        formatter: formatScores,
      },
      toolbox: { show: false },
      dataZoom: [{ show: false, disabled: true }],
    };
  }

  // CTFd merges these overrides in place when it redraws each graph.
  const graphTitles = {
    userScoreGraphChartOptions: "획득 점수 추이",
    teamScoreGraphChartOptions: "팀 점수 추이",
    scoreboardChartOptions: window.init?.userMode === "teams" ? "상위 10개 팀의 점수 추이" : "상위 10명의 점수 추이",
  };
  for (const [name, title] of Object.entries(graphTitles)) {
    Object.defineProperty(window, name, { configurable: true, get: () => scoreGraphOptions(title) });
  }
})();
