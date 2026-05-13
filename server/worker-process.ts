import { runDealEventsWorker } from "@/server/workers/deal-events";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const pollInterval = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 30_000);

  console.log("[worker-process] starting", { pollInterval });

  let running = true;

  process.on("SIGTERM", () => {
    console.log("[worker-process] SIGTERM received, shutting down");
    running = false;
  });

  while (running) {
    try {
      const summary = await runDealEventsWorker();
      console.log("[worker-process] run complete", summary);
    } catch (error) {
      console.error("[worker-process] run failed", error);
    }

    if (!running) {
      break;
    }

    await sleep(pollInterval);
  }
}

main().catch((error) => {
  console.error("[worker-process] fatal", error);
  process.exit(1);
});
