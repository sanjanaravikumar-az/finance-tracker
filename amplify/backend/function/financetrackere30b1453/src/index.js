/**
 * AppSync GraphQL resolver for calculating financial summary
 * @type {import('@types/aws-lambda').AppSyncResolverHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    
    try {
        // Get transactions from GraphQL arguments
        const transactions = event.arguments?.transactions || [];
        
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
        
        // Return the summary directly (AppSync handles the response wrapping)
        return summary;
        
    } catch (error) {
        console.error('Error calculating summary:', error);
        throw error;
    }
};
