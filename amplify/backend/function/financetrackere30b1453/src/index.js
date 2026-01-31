const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

/**
 * AppSync GraphQL resolver for calculating financial summary and sending notifications
 * @type {import('@types/aws-lambda').AppSyncResolverHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    
    const fieldName = event.info?.fieldName;
    
    try {
        // Handle different GraphQL operations
        switch (fieldName) {
            case 'calculateFinancialSummary':
                return await calculateSummaryFromDB(event);
            
            case 'sendMonthlyReport':
                return await sendMonthlyReport(event);
            
            case 'sendBudgetAlert':
                return await sendBudgetAlert(event);
            
            case 'subscribeToNotifications':
                return await subscribeToNotifications(event);
            
            default:
                throw new Error(`Unknown field: ${fieldName}`);
        }
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};

async function calculateSummaryFromDB(event) {
    const tableName = process.env.API_FINANCETRACKER_TRANSACTIONTABLE_NAME;
    
    if (!tableName) {
        throw new Error('Transaction table name not configured');
    }
    
    // Get the user's identity from the event (Cognito user)
    const userId = event.identity?.sub || event.identity?.username;
    
    try {
        // Scan all transactions from DynamoDB
        // In production, you'd want to add pagination and filtering by user
        const result = await dynamodb.scan({
            TableName: tableName
        }).promise();
        
        const transactions = result.Items || [];
        
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
        
        return summary;
    } catch (error) {
        console.error('Error reading from DynamoDB:', error);
        throw error;
    }
}

async function sendMonthlyReport(event) {
    const { email } = event.arguments;
    const topicArn = process.env.MONTHLY_REPORT_TOPIC_ARN;
    const tableName = process.env.API_FINANCETRACKER_TRANSACTIONTABLE_NAME;
    
    if (!topicArn) {
        return {
            success: false,
            message: 'Monthly report topic not configured'
        };
    }
    
    try {
        // Get financial summary from DynamoDB
        const result = await dynamodb.scan({
            TableName: tableName
        }).promise();
        
        const transactions = result.Items || [];
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
        
        // Send SNS notification with actual data
        await sns.publish({
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
        }).promise();
        
        return {
            success: true,
            message: 'Monthly report sent successfully!'
        };
    } catch (error) {
        console.error('Error sending monthly report:', error);
        return {
            success: false,
            message: `Failed to send report: ${error.message}`
        };
    }
}

async function sendBudgetAlert(event) {
    const { email, category, exceeded } = event.arguments;
    const topicArn = process.env.BUDGET_ALERT_TOPIC_ARN;
    const tableName = process.env.API_FINANCETRACKER_TRANSACTIONTABLE_NAME;
    
    if (!topicArn) {
        return {
            success: false,
            message: 'Budget alert topic not configured'
        };
    }
    
    try {
        // Get category spending from DynamoDB
        const result = await dynamodb.scan({
            TableName: tableName,
            FilterExpression: 'category = :category AND #type = :type',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':category': category,
                ':type': 'EXPENSE'
            }
        }).promise();
        
        const categoryTransactions = result.Items || [];
        const totalSpent = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        await sns.publish({
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
        }).promise();
        
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
