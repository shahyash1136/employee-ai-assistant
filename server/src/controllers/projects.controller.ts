import type { Request, Response } from "express";
import { projectServices } from "../services/project.service.js";

export const getProjects = async (req: Request, res: Response) => {
  try {
    const projects = await projectServices.getProjects();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};

export const getProjectsByEmployee = async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId || Array.isArray(employeeId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid employeeId parameter" });
    }

    const projects = await projectServices.getProjectsByEmployee(employeeId);
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};
