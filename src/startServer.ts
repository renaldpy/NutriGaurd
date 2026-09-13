import "dotenv/config";
import { createServer } from "./server.js";
import { logger } from "./logger.js";

const PORT = Number(process.env.PORT) || 4000;

createServer().listen(PORT, () => {
  logger.info(`family-cart-ai server listening on port ${PORT}`);
});
