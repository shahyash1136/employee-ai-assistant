import express from "express";
import employeeRoutes from "./routes/employee.routes.js";
import chatRoute from "./routes/chat.route.js";
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Employee Agent API is running 🚀",
  });
});

app.use("/employees", employeeRoutes);
app.use("/chat", chatRoute);

export default app;
