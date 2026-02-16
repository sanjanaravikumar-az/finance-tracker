import { defineData } from "@aws-amplify/backend";

const schema = `# This "input" configures a global authorization rule to enable public access to
# all models in this schema. Learn more about authorization rules here: https://docs.amplify.aws/cli/graphql/authorization-rules
input AMPLIFY { globalAuthRule: AuthRule = { allow: public } } # FOR TESTING ONLY!

type Transaction @model {
  id: ID!
  description: String!
  amount: Float!
  type: TransactionType!
  category: String!
  date: AWSDateTime!
  receiptUrl: String
  owner: String
}

enum TransactionType {
  INCOME
  EXPENSE
}

type Budget @model {
  id: ID!
  category: String!
  limit: Float!
  month: String!
  owner: String
}

type FinancialSummary @model {
  id: ID!
  totalIncome: Float!
  totalExpenses: Float!
  balance: Float!
  month: String!
  owner: String
}

# Custom query to calculate financial summary using Lambda
type CalculatedSummary {
  totalIncome: Float!
  totalExpenses: Float!
  balance: Float!
  savingsRate: Float!
}

type NotificationResult {
  success: Boolean!
  message: String!
}

type Query {
  calculateFinancialSummary: CalculatedSummary @function(name: "financetrackere30b1453-main")
}

type Mutation {
  sendMonthlyReport(email: String!): NotificationResult @function(name: "financetrackere30b1453-main")
  sendBudgetAlert(email: String!, category: String!, exceeded: Float!): NotificationResult @function(name: "financetrackere30b1453-main")
}
`;

export const data = defineData({
    migratedAmplifyGen1DynamoDbTableMappings: [{
            //The "branchname" variable needs to be the same as your deployment branch if you want to reuse your Gen1 app tables
            branchName: "main",
            modelNameToTableNameMapping: { Transaction: "Transaction-dfw7ohkaffdonp4v2b7tn4pvmq-main", Budget: "Budget-dfw7ohkaffdonp4v2b7tn4pvmq-main", FinancialSummary: "FinancialSummary-dfw7ohkaffdonp4v2b7tn4pvmq-main" }
        }],
    authorizationModes: {
        defaultAuthorizationMode: "apiKey",
        apiKeyAuthorizationMode: { expiresInDays: 100 }
    },
    schema
});
