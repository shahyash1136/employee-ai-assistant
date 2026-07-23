import express from "express";
import employeeRoutes from "./routes/employee.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import departmentsRoutes from "./routes/departments.route.js";
import performanceRoutes from "./routes/performance.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
import salariesRoutes from "./routes/salaries.routes.js";
import chatRoute from "./routes/chat.route.js";
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

export default app;
