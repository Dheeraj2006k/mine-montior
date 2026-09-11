import { runNormal } from "./normal.mjs";
import { runHighRisk } from "./high-risk.mjs";
import { runBlast } from "./blast.mjs";
import { runSensorFailure } from "./sensor-failure.mjs";

function parseArgs(argv) {
  const args = { scenario: "normal", iterations: 10, intervalMs: 3000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--scenario") args.scenario = argv[++i];
    else if (arg === "--iterations") args.iterations = Number(argv[++i]);
    else if (arg === "--interval-ms") args.intervalMs = Number(argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const scenarios = {
  normal: () => runNormal({ iterations: args.iterations, intervalMs: args.intervalMs }),
  "high-risk": () => runHighRisk(),
  blast: () => runBlast(),
  "sensor-failure": () => runSensorFailure(),
};

const run = scenarios[args.scenario];
if (!run) {
  console.error(`Unknown scenario "${args.scenario}". Available: ${Object.keys(scenarios).join(", ")}`);
  process.exit(1);
}

run().catch((err) => {
  console.error("simulator failed:", err.message);
  process.exit(1);
});
