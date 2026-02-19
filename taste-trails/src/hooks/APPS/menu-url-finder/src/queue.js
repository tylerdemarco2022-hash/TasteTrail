const { Queue } = require("bullmq");
const Redis = require("ioredis");

const connection = new Redis({
  url: process.env.REDIS_URL,
  maxRetriesPerRequest: null,
});

const queue = new Queue("menuQueue", { connection });

module.exports = { queue, connection };