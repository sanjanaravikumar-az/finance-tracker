import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
const branchName = process.env.AWS_BRANCH ?? "sandbox";
const projectName = "financetracker";
export class cdkStack extends Construct {
    constructor(scope: Construct, id: string, data: any, auth: any, storage: any) {
        super(scope, id);
        /* Do not remove - Amplify CLI automatically injects the current deployment environment in this input parameter */
        new cdk.CfnParameter(this, "env", {
            type: "String",
            description: "Current Amplify CLI env name",
            default: `${branchName}`
        });
        // Dynamic references to other resources' outputs
        const graphqlApiId = cdk.Fn.ref(dependencies.api.financetracker.GraphQLAPIIdOutput);
        const userPoolId = cdk.Fn.ref(dependencies.auth.financetrackerb192a2d4.UserPoolId);
        // Use raw logical ID to bypass cloud build type generation bug for storage
        const s3BucketName = cdk.Fn.ref('storages361d53dc0BucketName');
        // 1. SNS Topic for Budget Alerts
        const budgetAlertTopic = new sns.Topic(this, 'BudgetAlertTopic', {
            topicName: `finance-budget-alerts-${branchName}`,
            displayName: 'Fin Tracker Budget Alerts',
        });
        new cdk.CfnOutput(this, 'BudgetAlertTopicArn', {
            value: budgetAlertTopic.topicArn,
            description: 'SNS Topic ARN for budget alerts',
            exportName: `${projectName}-BudgetAlertTopicArn-${branchName}`,
        });
        // 2. SNS Topic for Monthly Reports
        const monthlyReportTopic = new sns.Topic(this, 'MonthlyReportTopic', {
            topicName: `finance-monthly-reports-${branchName}`,
            displayName: 'Finance Tracker Monthly Reports',
        });
        // Note: Email subscriptions will be managed dynamically by Lambda
        // when users click the email button (allows any user to subscribe)
        new cdk.CfnOutput(this, 'MonthlyReportTopicArn', {
            value: monthlyReportTopic.topicArn,
            description: 'SNS Topic ARN for monthly reports',
            exportName: `${projectName}-MonthlyReportTopicArn-${branchName}`,
        });
        // 3. Add tags for resource organization
        cdk.Tags.of(this).add('Project', 'FinanceTracker');
        cdk.Tags.of(this).add('Environment', branchName);
        cdk.Tags.of(this).add('ManagedBy', 'Amplify');
        // 4. Export referenced resource outputs for visibility
        new cdk.CfnOutput(this, 'ReferencedGraphQLApiId', {
            value: graphqlApiId,
            description: 'GraphQL API ID from Amplify API resource',
        });
        new cdk.CfnOutput(this, 'ReferencedUserPoolId', {
            value: userPoolId,
            description: 'Cognito User Pool ID from Amplify auth resource',
        });
        new cdk.CfnOutput(this, 'ReferencedS3BucketName', {
            value: s3BucketName,
            description: 'S3 Bucket Name from Amplify storage resource',
        });
    }
}
