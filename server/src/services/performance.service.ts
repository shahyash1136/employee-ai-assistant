import { csvService } from "./csv.service.js";
import type { Performance, PerformanceCsvRow } from "../types/performance.js";

export class PerformanceService {
  async getPerformance() {
    return csvService.readCsv<PerformanceCsvRow, Performance>(
      "performance.csv",
      (row) => ({
        employeeID: row.EmployeeID,
        promotionEligible: row.PromotionEligible,
        rating: Number(row.Rating),
        reviewComments: row.ReviewComments,
        year: Number(row.Year),
      }),
    );
  }
}

export const performanceService = new PerformanceService();
