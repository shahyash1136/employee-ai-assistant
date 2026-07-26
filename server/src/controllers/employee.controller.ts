import type { Request, Response } from "express";
import { employeeService } from "../services/employee.service.js";

export const getAllEmployees = async (req: Request, res: Response) => {
  try {
    const employees = await employeeService.getAllEmployees();
    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};

export const getEmployeeById = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Employee id is required" });
    }
    const employee = await employeeService.getEmployeeById(id);
    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};

export const getEmployeeByName = async (req: Request, res: Response) => {
  try {
    const name = (req.query.name as string) ?? "";
    const employees = await employeeService.getEmployeeByName(name);
    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};

export const getEmployeesByDepartment = async (req: Request, res: Response) => {
  try {
    const departmentId = Array.isArray(req.params.departmentId)
      ? req.params.departmentId[0]
      : req.params.departmentId;
    if (!departmentId) {
      return res
        .status(400)
        .json({ success: false, message: "Department id is required" });
    }
    const employees =
      await employeeService.getEmployeesByDepartment(departmentId);
    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};
