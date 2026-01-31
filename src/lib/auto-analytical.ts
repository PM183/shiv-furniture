import prisma from './prisma';
import { ProductCategory } from '@prisma/client';

export interface AutoAnalyticalResult {
  analyticalAccountId: string | null;
  ruleName: string | null;
}

export async function getAnalyticalAccountForProduct(
  productId: string,
  productCategory?: ProductCategory,
  productName?: string
): Promise<AutoAnalyticalResult> {
  // First check if product already has an analytical account
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { analyticalAccountId: true, category: true, name: true },
  });

  if (product?.analyticalAccountId) {
    return {
      analyticalAccountId: product.analyticalAccountId,
      ruleName: 'Product Default',
    };
  }

  const category = productCategory || product?.category;
  const name = productName || product?.name || '';

  // Get all active rules ordered by priority
  const rules = await prisma.autoAnalyticalRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' },
    include: { analyticalAccount: true },
  });

  for (const rule of rules) {
    // Check category match
    if (rule.productCategory && category === rule.productCategory) {
      return {
        analyticalAccountId: rule.analyticalAccountId,
        ruleName: rule.name,
      };
    }

    // Check name contains match
    if (rule.productNameContains && name.toLowerCase().includes(rule.productNameContains.toLowerCase())) {
      return {
        analyticalAccountId: rule.analyticalAccountId,
        ruleName: rule.name,
      };
    }
  }

  return {
    analyticalAccountId: null,
    ruleName: null,
  };
}

export async function applyAutoAnalyticalToLines<T extends { productId: string; analyticalAccountId?: string | null }>(
  lines: T[]
): Promise<T[]> {
  return Promise.all(
    lines.map(async (line) => {
      if (line.analyticalAccountId) return line;
      
      const result = await getAnalyticalAccountForProduct(line.productId);
      return {
        ...line,
        analyticalAccountId: result.analyticalAccountId,
      };
    })
  );
}
