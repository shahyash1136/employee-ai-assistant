import "dotenv/config";

import app from "./app.js";
import { registerTracing } from "./tracing/registerTracing.js";

registerTracing();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
