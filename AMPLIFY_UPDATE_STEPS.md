# Amplify CLI Steps to Update Function and Custom Resources

## What Changed:

### 1. **Custom Resource (CDK Stack)**
- ✅ Removed EventBridge Rule
- ✅ Kept only 2 SNS Topics (Budget Alerts + Monthly Reports)

### 2. **Lambda Function**
- ✅ Now reads transactions from DynamoDB
- ✅ Calculates summaries from actual database data
- ✅ Sends SNS notifications with real financial data
- ✅ Added DynamoDB permissions
- ✅ Added SNS publish permissions
- ✅ Added environment variables for SNS topic ARNs and DynamoDB table name

### 3. **GraphQL Schema**
- ✅ Removed `transactions` parameter from `calculateFinancialSummary` query
- ✅ Lambda now reads directly from DynamoDB instead

### 4. **Frontend**
- ✅ Updated to call simplified GraphQL query (no parameters needed)

---

## CLI Steps to Deploy:

### Step 1: Update the Custom Resource
The custom resource (CDK stack) has been modified. No CLI command needed - it will be deployed with `amplify push`.

### Step 2: Update the Function Dependencies
The function now depends on:
- Custom resource (for SNS topic ARNs)
- API (for DynamoDB table name)

This is already configured in `function-parameters.json`.

### Step 3: Deploy Everything
Run a single command to deploy all changes:

```bash
amplify push
```

This will:
1. Update the custom CDK stack (remove EventBridge, keep SNS)
2. Update the Lambda function with new code
3. Grant Lambda permissions to:
   - Read from DynamoDB (Transaction table)
   - Publish to SNS topics
4. Update the GraphQL schema
5. Connect everything together

### Step 4: Verify Deployment
After deployment completes, check the outputs:

```bash
amplify status
```

You should see:
- ✅ Custom resource: `customfinance`
- ✅ Function: `financetrackere30b1453`
- ✅ API: `financetracker`
- ✅ Auth: `financetrackerb192a2d4`
- ✅ Storage: `s361d53dc0`

---

## Testing the New Features:

### 1. Test Financial Summary Calculation
The Lambda now reads from DynamoDB automatically:

```graphql
query {
  calculateFinancialSummary {
    totalIncome
    totalExpenses
    balance
    savingsRate
  }
}
```

### 2. Test Monthly Report (SNS)
Send a monthly report email:

```graphql
mutation {
  sendMonthlyReport(email: "your-email@example.com") {
    success
    message
  }
}
```

### 3. Test Budget Alert (SNS)
Send a budget alert email:

```graphql
mutation {
  sendBudgetAlert(
    email: "your-email@example.com"
    category: "Food"
    exceeded: 50.00
  ) {
    success
    message
  }
}
```

---

## Subscribe to SNS Topics:

After deployment, you need to subscribe your email to receive notifications:

### Option 1: Via AWS Console
1. Go to AWS SNS Console
2. Find topics:
   - `finance-budget-alerts-main`
   - `finance-monthly-reports-main`
3. Click "Create subscription"
4. Protocol: Email
5. Endpoint: your-email@example.com
6. Confirm the subscription email

### Option 2: Via AWS CLI
```bash
# Get your topic ARNs
aws sns list-topics

# Subscribe to budget alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:YOUR_ACCOUNT:finance-budget-alerts-main \
  --protocol email \
  --notification-endpoint your-email@example.com

# Subscribe to monthly reports
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:YOUR_ACCOUNT:finance-monthly-reports-main \
  --protocol email \
  --notification-endpoint your-email@example.com
```

Then check your email and confirm both subscriptions.

---

## Permissions Summary:

The Lambda function now has:

### DynamoDB Permissions:
- `dynamodb:Scan` - Read all transactions
- `dynamodb:Query` - Query specific transactions
- `dynamodb:GetItem` - Get individual transactions

### SNS Permissions:
- `sns:Publish` - Send notifications to both topics

### Environment Variables:
- `BUDGET_ALERT_TOPIC_ARN` - Budget alert SNS topic
- `MONTHLY_REPORT_TOPIC_ARN` - Monthly report SNS topic
- `API_FINANCETRACKER_TRANSACTIONTABLE_NAME` - DynamoDB table name

---

## Troubleshooting:

### If deployment fails:
```bash
# Check the error message
amplify push

# If there are dependency issues, try:
amplify env checkout main
amplify push --force
```

### If Lambda can't access DynamoDB:
Check that the custom-policies.json has DynamoDB permissions (already added).

### If Lambda can't publish to SNS:
Check that the custom-policies.json has SNS publish permissions (already added).

### If environment variables are missing:
The CloudFormation template has been updated to pass all required variables.

---

## Summary:

Just run `amplify push` and everything will be deployed with the correct permissions and dependencies! 🚀
