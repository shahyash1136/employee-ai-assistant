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

  async getTopPerformers(minRating: number = 4.5): Promise<Performance[]> {
    const performance = await this.getPerformance();
    return performance
      .filter((p) => p.rating >= minRating)
      .sort((a, b) => b.rating - a.rating);
  }
}

export const performanceService = new PerformanceService();
