import express from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./openapi/swagger.js";
import employeeRoutes from "./routes/employee.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import departmentsRoutes from "./routes/departments.route.js";
import performanceRoutes from "./routes/performance.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
import salariesRoutes from "./routes/salaries.routes.js";
import chatRoute from "./routes/chat.route.js";
import tracesRoute from "./routes/traces.route.js";
import approvalsRoute from "./routes/approvals.route.js";
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Employee Agent API is running 🚀",
  });
});

app.use("/attendance", attendanceRoutes);
app.use("/departments", departmentsRoutes);
app.use("/employees", employeeRoutes);
app.use("/performance", performanceRoutes);
app.use("/projects", projectsRoutes);
app.use("/salaries", salariesRoutes);
app.use("/chat", chatRoute);
app.use("/traces", tracesRoute);
app.use("/approvals", approvalsRoute);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

export default app;
