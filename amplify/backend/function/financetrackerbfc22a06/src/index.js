/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    
    const { httpMethod, body } = event;
    
    if (httpMethod === 'POST') {
        const data = JSON.parse(body || '{}');
        const { transactions } = data;
        
        // Calculate financial summary
        const summary = transactions.reduce((acc, transaction) => {
            if (transaction.type === 'INCOME') {
                acc.totalIncome += transaction.amount;
            } else {
                acc.totalExpenses += transaction.amount;
            }
            return acc;
        }, { totalIncome: 0, totalExpenses: 0 });
        
        summary.balance = summary.totalIncome - summary.totalExpenses;
        summary.savingsRate = summary.totalIncome > 0 
            ? ((summary.balance / summary.totalIncome) * 100).toFixed(2) 
            : 0;
        
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            },
            body: JSON.stringify(summary),
        };
    }
    
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({ message: 'Finance Calculator Lambda' }),
    };
};
