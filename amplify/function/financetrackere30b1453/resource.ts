import { defineFunction } from "@aws-amplify/backend";

const branchName = process.env.AWS_BRANCH ?? "sandbox";

export const financetrackere30b1453 = defineFunction({
    entry: "./index.js",
    name: `financetrackere30b1453-${branchName}`,
    timeoutSeconds: 25,
    memoryMB: 128,
    environment: { BUDGET_ALERT_TOPIC_ARN: "arn:aws:sns:us-east-1:079385506759:finance-budget-alerts-main", MONTHLY_REPORT_TOPIC_ARN: "arn:aws:sns:us-east-1:079385506759:finance-monthly-reports-main", ENV: `${branchName}`, REGION: "us-east-1" },
    runtime: 22,
    bundling: {
        format: "esm",
        minify: false,
        esbuildArgs: {
            "--external:@aws-sdk/*": ""
        }
    }
});
