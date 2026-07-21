import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";
import type { Employee } from "../types/employee.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const employeesCsvPath = path.resolve(__dirname, "../../../data/employees.csv");

export const readEmployees = (): Promise<Employee[]> => {
  return new Promise((resolve, reject) => {
    const employees: Employee[] = [];

    fs.createReadStream(employeesCsvPath)
      .pipe(csv())
      .on("data", (row) =>
        employees.push({
          employeeID: row.EmployeeID,
          firstName: row.FirstName,
          lastName: row.LastName,
          departmentID: row.DepartmentID,
          managerID: row.ManagerID,
          designation: row.Designation,
          joiningDate: row.JoiningDate,
          email: row.Email,
          location: row.Location,
        }),
      )
      .on("end", () => resolve(employees))
      .on("error", reject);
  });
};
