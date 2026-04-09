import { prisma } from "../src/utils/db";
import { createLogger } from "../src/utils/logger";

const logger = createLogger({ component: "verify_transaction_logging" });

async function main() {
  try {
    logger.info("Checking Transaction table...");

    // Count total transactions
    const totalCount = await prisma.transaction.count();
    logger.info({ totalCount }, "Total transactions in database");

    // Get recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    logger.info(
      { count: recentTransactions.length },
      "Recent transactions retrieved"
    );

    // Display transaction details
    recentTransactions.forEach((tx: any) => {
      logger.info(
        {
          id: tx.id,
          status: tx.status,
          txHash: tx.txHash,
          innerTxHash: tx.innerTxHash,
          tenantId: tx.tenantId,
          costStroops: tx.costStroops.toString(),
          createdAt: tx.createdAt,
        },
        "Transaction record"
      );
    });

    // Group by status
    const statusCounts = await prisma.transaction.groupBy({
      by: ["status"],
      _count: true,
    });

    logger.info({ statusCounts }, "Transactions grouped by status");

    // Group by tenant
    const tenantCounts = await prisma.transaction.groupBy({
      by: ["tenantId"],
      _count: true,
    });

    logger.info({ tenantCounts }, "Transactions grouped by tenant");

    logger.info("✅ Transaction logging verification complete");
  } catch (error: any) {
    logger.error({ error: error.message }, "Verification failed");
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
