const { QueueEvents } = require("bullmq");
const { connection } = require("./queue");

const queueEvents = new QueueEvents("crawlRestaurant", { connection });

queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed:`, failedReason);
});

queueEvents.on("completed", ({ jobId }) => {
  console.log(`Job ${jobId} completed successfully.`);
});

module.exports = queueEvents;