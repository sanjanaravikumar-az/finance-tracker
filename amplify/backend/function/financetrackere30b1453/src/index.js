const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const sns = new SNSClient({});
const sts = new STSClient({});

/**
 * AppSync GraphQL resolver for calculating financial summary and sending notifications
 * @type {import('@types/aws-lambda').AppSyncResolverHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event, null, 2)}`);
    
    // AppSync passes fieldName in event.info.fieldName
    const fieldName = event.info?.fieldName || event.fieldName;
    
    // Get arguments - AppSync can pass them in different ways
    const args = event.arguments || event.args || {};
    
    console.log('Field Name:', fieldName);
    console.log('Arguments:', JSON.stringify(args, null, 2));
    
    try {
        // Handle different GraphQL operations
        switch (fieldName) {
            case 'calculateFinancialSummary':
                return await calculateSummaryFromDB();
            
            case 'sendMonthlyReport':
                return await sendMonthlyReport(args);
            
            case 'sendBudgetAlert':
                return await sendBudgetAlert(args);
            
            default:
                console.error('Unknown operation. Event structure:', JSON.stringify(event, null, 2));
                throw new Error(`Unknown field: ${fieldName}. Full event logged to CloudWatch.`);
        }
    } catch (error) {
        console.error('Handler Error:', error);
        console.error('Error stack:', error.stack);
        // Return error in a format AppSync can handle
        return {
            success: false,
            message: `Error: ${error.message}`
        };
    }
};

async function calculateSummaryFromDB() {
    console.log('calculateSummaryFromDB called');
    const tableName = process.env.API_FINANCETRACKER_TRANSACTIONTABLE_NAME;
    
    console.log('Table name:', tableName);
    
    if (!tableName) {
        throw new Error('Transaction table name not configured');
    }
    
    try {
        // Scan all transactions from DynamoDB
        const result = await dynamodb.send(new ScanCommand({
            TableName: tableName
        }));
        
        const transactions = result.Items || [];
        console.log('Found transactions:', transactions.length);
        
        // Calculate financial summary
        const summary = transactions.reduce((acc, transaction) => {
            if (transaction.type === 'INCOME') {
                acc.totalIncome += transaction.amount;
            } else if (transaction.type === 'EXPENSE') {
                acc.totalExpenses += transaction.amount;
            }
            return acc;
        }, { totalIncome: 0, totalExpenses: 0 });
        
        summary.balance = summary.totalIncome - summary.totalExpenses;
        summary.savingsRate = summary.totalIncome > 0 
            ? parseFloat(((summary.balance / summary.totalIncome) * 100).toFixed(2))
            : 0;
        
        console.log('Calculated summary:', summary);
        return summary;
    } catch (error) {
        console.error('Error reading from DynamoDB:', error);
        throw error;
    }
}

async function sendMonthlyReport(args) {
    console.log('sendMonthlyReport called with args:', JSON.stringify(args, null, 2));
    
    const email = args.email;
    console.log('Email:', email);
    
    if (!email) {
        console.error('No email provided in arguments');
        return {
            success: false,
            message: 'Email is required'
        };
    }
    
    const env = process.env.ENV || 'main';
    const region = process.env.REGION || 'us-east-1';
    
    try {
        // Construct topic ARN from environment
        const accountId = await getAccountId();
        const topicArn = `arn:aws:sns:${region}:${accountId}:finance-monthly-reports-${env}`;
        
        console.log('Using topic ARN:', topicArn);
        
        const tableName = process.env.API_FINANCETRACKER_TRANSACTIONTABLE_NAME;
        console.log('Table name:', tableName);
        
        // Get financial summary from DynamoDB
        const result = await dynamodb.send(new ScanCommand({
            TableName: tableName
        }));
        
        const transactions = result.Items || [];
        console.log('Found transactions:', transactions.length);
        
        const summary = transactions.reduce((acc, transaction) => {
            if (transaction.type === 'INCOME') {
                acc.totalIncome += transaction.amount;
            } else if (transaction.type === 'EXPENSE') {
                acc.totalExpenses += transaction.amount;
            }
            return acc;
        }, { totalIncome: 0, totalExpenses: 0 });
        
        summary.balance = summary.totalIncome - summary.totalExpenses;
        summary.savingsRate = summary.totalIncome > 0 
            ? ((summary.balance / summary.totalIncome) * 100).toFixed(2)
            : 0;
        
        console.log('Calculated summary:', summary);
        
        // Send SNS notification with actual data
        const snsResult = await sns.send(new PublishCommand({
            TopicArn: topicArn,
            Subject: '📊 Your Monthly Financial Report',
            Message: `Hello,

Here is your monthly financial report:

💰 Total Income: $${summary.totalIncome.toFixed(2)}
💸 Total Expenses: $${summary.totalExpenses.toFixed(2)}
💵 Balance: $${summary.balance.toFixed(2)}
📈 Savings Rate: ${summary.savingsRate}%

Total Transactions: ${transactions.length}

This report was generated on ${new Date().toLocaleDateString()}.

Best regards,
Finance Tracker Team`,
            MessageAttributes: {
                email: {
                    DataType: 'String',
                    StringValue: email
                }
            }
        }));
        
        console.log('SNS publish result:', JSON.stringify(snsResult, null, 2));
        
        const response = {
            success: true,
            message: 'Monthly report sent successfully!'
        };
        
        console.log('Returning response:', response);
        return response;
    } catch (error) {
        console.error('Error sending monthly report:', error);
        console.error('Error stack:', error.stack);
        const errorResponse = {
            success: false,
            message: `Failed to send report: ${error.message}`
        };
        console.log('Returning error response:', errorResponse);
        return errorResponse;
    }
}

async function sendBudgetAlert(args) {
    console.log('sendBudgetAlert called with args:', JSON.stringify(args, null, 2));
    
    const { email, category, exceeded } = args;
    const env = process.env.ENV || 'main';
    const region = process.env.REGION || 'us-east-1';
    
    try {
        // Construct topic ARN from environment
        const accountId = await getAccountId();
        const topicArn = `arn:aws:sns:${region}:${accountId}:finance-budget-alerts-${env}`;
        
        console.log('Using topic ARN:', topicArn);
        
        const tableName = process.env.API_FINANCETRACKER_TRANSACTIONTABLE_NAME;
        
        // Get category spending from DynamoDB
        const result = await dynamodb.send(new ScanCommand({
            TableName: tableName,
            FilterExpression: 'category = :category AND #type = :type',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':category': category,
                ':type': 'EXPENSE'
            }
        }));
        
        const categoryTransactions = result.Items || [];
        const totalSpent = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        await sns.send(new PublishCommand({
            TopicArn: topicArn,
            Subject: `⚠️ Budget Alert: ${category}`,
            Message: `Hello,

⚠️ BUDGET ALERT ⚠️

You have exceeded your budget for ${category} by $${exceeded.toFixed(2)}.

Category: ${category}
Total Spent: $${totalSpent.toFixed(2)}
Number of Transactions: ${categoryTransactions.length}

Consider reviewing your spending in this category.

Best regards,
Finance Tracker Team`,
            MessageAttributes: {
                email: {
                    DataType: 'String',
                    StringValue: email
                },
                category: {
                    DataType: 'String',
                    StringValue: category
                },
                exceeded: {
                    DataType: 'Number',
                    StringValue: exceeded.toString()
                }
            }
        }));
        
        return {
            success: true,
            message: 'Budget alert sent successfully!'
        };
    } catch (error) {
        console.error('Error sending budget alert:', error);
        return {
            success: false,
            message: `Failed to send alert: ${error.message}`
        };
    }
}

// Helper function to get AWS account ID from STS
async function getAccountId() {
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    return identity.Account;
}
