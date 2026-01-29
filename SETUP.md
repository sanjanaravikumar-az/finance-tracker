# Finance Tracker Setup Guide

This finance tracker app demonstrates all Amplify Gen1 resources:
- **Auth**: User authentication and authorization
- **API (GraphQL)**: Transaction and budget data management
- **Storage (S3)**: Receipt file uploads
- **Lambda Function**: Financial calculations
- **Custom Resources**: CDK-based custom infrastructure

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Push Amplify Backend
```bash
amplify push
```

This will:
- Deploy the updated GraphQL schema with Transaction, Budget, and FinancialSummary models
- Configure authentication
- Set up S3 storage for receipts
- Deploy the Lambda function for calculations

### 3. Create a Test User
```bash
amplify console auth
```

Or use the Amplify CLI:
```bash
amplify auth console
```

Create a user with:
- Username: `testuser`
- Password: `TestPassword123!`

### 4. Run the App
```bash
npm run dev
```

## Features Demonstrated

### 🔐 Authentication (Amplify Auth)
- Sign in/sign out functionality
- User session management
- Protected routes

### 📊 GraphQL API
- **Transactions**: Create and list financial transactions
- **Types**: Income and Expense tracking
- **Categories**: Organize transactions by category
- **Real-time data**: Automatic updates after mutations

### 📁 S3 Storage
- Upload receipt images or PDFs
- Secure file storage with auth-based access
- Generate signed URLs for viewing receipts

### ⚡ Lambda Function
- Calculate financial summaries
- Compute savings rate
- Process transaction data
- Custom business logic

### 🏗️ Custom Resources
- CDK-based infrastructure (in `amplify/backend/custom/customfinance/`)
- Extensible for additional AWS services

## App Structure

```
src/
├── App.tsx          # Main application with all Amplify integrations
├── App.css          # Styling
└── aws-exports.js   # Auto-generated Amplify configuration

amplify/backend/
├── api/             # GraphQL schema and resolvers
├── auth/            # Cognito configuration
├── storage/         # S3 bucket configuration
├── function/        # Lambda function for calculations
└── custom/          # Custom CDK resources
```

## Usage

1. **Sign In**: Click "Sign In" to authenticate
2. **Add Transactions**: Fill out the form to add income or expenses
3. **Upload Receipts**: Optionally attach receipt files (stored in S3)
4. **View Summary**: See calculated totals, balance, and savings rate (via Lambda)
5. **Track History**: View all transactions with categories and dates

## GraphQL Schema

The app uses these main types:

- **Transaction**: Individual income/expense records
- **Budget**: Monthly budget limits by category
- **FinancialSummary**: Aggregated financial data

## Next Steps

- Add budget tracking features
- Implement category-based analytics
- Add data visualization with charts
- Set up budget alerts using custom resources
- Implement recurring transactions
