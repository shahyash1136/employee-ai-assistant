import type { Request, Response } from "express";
import { projectServices } from "../services/project.service.js";

export const getProjects = async (req: Request, res: Response) => {
  try {
    const projects = await projectServices.getProjects();

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to read CSV",
    });
  }
};
