/* Amplify Params - DO NOT EDIT
	API_FINANCETRACKER_GRAPHQLAPIENDPOINTOUTPUT
	API_FINANCETRACKER_GRAPHQLAPIIDOUTPUT
	API_FINANCETRACKER_GRAPHQLAPIKEYOUTPUT
	AUTH_FINANCETRACKERB192A2D4_USERPOOLID
	ENV
	REGION
Amplify Params - DO NOT EDIT */const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand, CreateTopicCommand, SubscribeCommand } = require('@aws-sdk/client-sns');
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
                const summary = await calculateSummaryFromDB();
                console.log('Handler returning summary:', summary);
                return summary;
            
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
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        
        // For calculateFinancialSummary, return zeros instead of null to avoid GraphQL errors
        if (fieldName === 'calculateFinancialSummary') {
            console.log('Returning default summary due to error');
            return {
                totalIncome: 0,
                totalExpenses: 0,
                balance: 0,
                savingsRate: 0
            };
        }
        
        // For mutations, return error response
        return {
            success: false,
            message: `Error: ${error.message}`
        };
    }
};

async function calculateSummaryFromDB() {
    console.log('=== calculateSummaryFromDB START ===');
    console.log('calculateSummaryFromDB called');
    
    // Try to get table name from environment variable
    let tableName = process.env.API_FINANCETRACKER_TRANSACTIONTABLE_NAME;
    console.log('Table name from env:', tableName);
    
    // If table name has NONE, we need to find the actual API ID
    if (!tableName || tableName.includes('NONE')) {
        console.log('Table name has NONE, need to find actual table');
        // The GraphQL API ID should be in the request headers or we can query DynamoDB to list tables
        // For now, let's try to list all tables and find the Transaction table
        const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
        const dynamoClientForList = new DynamoDBClient({});
        
        try {
            const listResult = await dynamoClientForList.send(new ListTablesCommand({}));
            console.log('Available tables:', JSON.stringify(listResult.TableNames, null, 2));
            
            // Find the Transaction table
            const transactionTable = listResult.TableNames.find(name => name.startsWith('Transaction-') && name.endsWith('-main'));
            if (transactionTable) {
                tableName = transactionTable;
                console.log('Found Transaction table:', tableName);
            } else {
                throw new Error('Could not find Transaction table in DynamoDB');
            }
        } catch (listError) {
            console.error('Error listing tables:', listError);
            throw new Error(`Could not list DynamoDB tables: ${listError.message}`);
        }
    }
    
    console.log('Final table name:', tableName);
    
    if (!tableName) {
        console.error('Transaction table name not configured');
        throw new Error('Transaction table name not configured');
    }
    
    try {
        // Scan all transactions from DynamoDB
        console.log('About to scan DynamoDB table:', tableName);
        const result = await dynamodb.send(new ScanCommand({
            TableName: tableName
        }));
        
        const transactions = result.Items || [];
        console.log('Found transactions:', transactions.length);
        console.log('Transactions:', JSON.stringify(transactions, null, 2));
        
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
        console.log('=== calculateSummaryFromDB END ===');
        return summary;
    } catch (error) {
        console.error('=== calculateSummaryFromDB ERROR ===');
        console.error('Error reading from DynamoDB:', error);
        console.error('Error name:', error.name);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        // Throw the error so we can see it in the frontend
        throw new Error(`DynamoDB error: ${error.message}`);
    }
}

async function sendMonthlyReport(args) {
    console.log('=== sendMonthlyReport START ===');
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
    console.log('Environment:', env);
    
    try {
        // Ensure SNS topic exists (create if it doesn't)
        const topicName = `finance-monthly-reports-${env}`;
        console.log('Topic name to create:', topicName);
        console.log('About to call ensureTopicExists...');
        
        const topicArn = await ensureTopicExists(topicName, email);
        console.log('ensureTopicExists returned. Topic ARN:', topicArn);
        
        const tableName = process.env.API_FINANCETRACKER_TRANSACTIONTABLE_NAME;
        console.log('Table name:', tableName);
        
        // Get financial summary from DynamoDB
        console.log('About to scan DynamoDB...');
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
        console.log('About to publish to SNS...');
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
        console.log('Message ID:', snsResult.MessageId);
        
        const response = {
            success: true,
            message: `Monthly report sent! Check ${email} for a confirmation email from AWS SNS, then click the button again.`
        };
        
        console.log('About to return response:', response);
        console.log('=== sendMonthlyReport END ===');
        return response;
    } catch (error) {
        console.error('=== sendMonthlyReport ERROR ===');
        console.error('Error sending monthly report:', error);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        console.error('Error code:', error.code);
        const errorResponse = {
            success: false,
            message: `Failed to send report: ${error.message}`
        };
        console.log('Returning error response:', errorResponse);
        console.log('=== sendMonthlyReport ERROR END ===');
        return errorResponse;
    }
}

async function sendBudgetAlert(args) {
    console.log('sendBudgetAlert called with args:', JSON.stringify(args, null, 2));
    
    const { email, category, exceeded } = args;
    const env = process.env.ENV || 'main';
    
    try {
        // Ensure SNS topic exists
        const topicName = `finance-budget-alerts-${env}`;
        const topicArn = await ensureTopicExists(topicName, email);
        
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

// Helper function to ensure SNS topic exists (creates if it doesn't)
async function ensureTopicExists(topicName, email) {
    console.log('Ensuring topic exists:', topicName);
    console.log('Email for subscription:', email);
    
    try {
        // Try to create the topic (idempotent - returns existing topic if it exists)
        console.log('Attempting to create topic...');
        const createResult = await sns.send(new CreateTopicCommand({
            Name: topicName
        }));
        
        const topicArn = createResult.TopicArn;
        console.log('Topic created/found. ARN:', topicArn);
        
        // Subscribe the email to the topic
        console.log('Attempting to subscribe email to topic...');
        const subscribeResult = await sns.send(new SubscribeCommand({
            TopicArn: topicArn,
            Protocol: 'email',
            Endpoint: email
        }));
        
        console.log('Subscription result:', JSON.stringify(subscribeResult, null, 2));
        console.log('Subscription ARN:', subscribeResult.SubscriptionArn);
        
        if (subscribeResult.SubscriptionArn === 'pending confirmation') {
            console.log('Email subscription pending confirmation - user needs to check email');
        }
        
        return topicArn;
    } catch (error) {
        console.error('Error in ensureTopicExists:', error);
        console.error('Error name:', error.name);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        throw new Error(`Failed to create/access SNS topic: ${error.message}`);
    }
}
