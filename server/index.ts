import { app } from "./app";
import { ENV } from "./lib/env";

app.listen(ENV.port, "0.0.0.0", () => {
  console.log(`🚀 PORTAL VETNEB API corriendo en puerto ${ENV.port}`);
});
