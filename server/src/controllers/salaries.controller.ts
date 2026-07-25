import type { Request, Response } from "express";
import { salaryServices } from "../services/salary.service.js";

export const getSalaries = async (req: Request, res: Response) => {
  try {
    const salaries = await salaryServices.getSalaries();
    res.json({ success: true, data: salaries });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};

export const getHighestSalary = async (req: Request, res: Response) => {
  try {
    const highest = await salaryServices.getHighestSalary();
    if (!highest) {
      return res
        .status(404)
        .json({ success: false, message: "No salary records found" });
    }
    res.json({ success: true, data: highest });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};

export const getAverageSalary = async (req: Request, res: Response) => {
  try {
    const average = await salaryServices.getAverageSalary();
    res.json({ success: true, data: { averageCTC: average } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};

export const getEmployeesBySalaryRange = async (
  req: Request,
  res: Response,
) => {
  try {
    const min = Number(req.query.min);
    const max = Number(req.query.max);

    if (Number.isNaN(min) || Number.isNaN(max)) {
      return res.status(400).json({
        success: false,
        message: "Query params 'min' and 'max' must be valid numbers",
      });
    }

    const salaries = await salaryServices.getEmployeesBySalaryRange(min, max);
    res.json({ success: true, data: salaries });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};

export const getSalaryByEmployee = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId;
    if (!employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing employeeId parameter",
      });
    }

    const salary = await salaryServices.getSalaryByEmployee(employeeId);
    if (!salary) {
      return res
        .status(404)
        .json({ success: false, message: "Salary record not found" });
    }
    res.json({ success: true, data: salary });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};
