import * as cdk from 'aws-cdk-lib';
import * as AmplifyHelpers from '@aws-amplify/cli-extensibility-helper';
import { AmplifyDependentResourcesAttributes } from '../../types/amplify-dependent-resources-ref';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';

export class cdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps, amplifyResourceProps?: AmplifyHelpers.AmplifyResourceProps) {
    super(scope, id, props);
    
    /* Do not remove - Amplify CLI automatically injects the current deployment environment in this input parameter */
    new cdk.CfnParameter(this, 'env', {
      type: 'String',
      description: 'Current Amplify CLI env name',
    });

    const amplifyProjectInfo = AmplifyHelpers.getProjectInfo();

    // Reference other Amplify resources (excluding function to avoid circular dependency)
    const dependencies: AmplifyDependentResourcesAttributes =
      AmplifyHelpers.addResourceDependency(
        this as any,
        amplifyResourceProps!.category,
        amplifyResourceProps!.resourceName,
        [
          { category: 'api', resourceName: 'financetracker' },
          { category: 'auth', resourceName: 'financetrackerb192a2d4' },
          { category: 'storage', resourceName: 's361d53dc0' },
        ]
      );

    // Dynamic references to other resources' outputs
    const graphqlApiId = cdk.Fn.ref(dependencies.api.financetracker.GraphQLAPIIdOutput);
    const userPoolId = cdk.Fn.ref(dependencies.auth.financetrackerb192a2d4.UserPoolId);
    const s3BucketName = cdk.Fn.ref(dependencies.storage.s361d53dc0.BucketName);

    // 1. SNS Topic for Budget Alerts
    const budgetAlertTopic = new sns.Topic(this, 'BudgetAlertTopic', {
      topicName: `finance-budget-alerts-${cdk.Fn.ref('env')}`,
      displayName: 'Fin Tracker Budget Alerts',
    });

    new cdk.CfnOutput(this, 'BudgetAlertTopicArn', {
      value: budgetAlertTopic.topicArn,
      description: 'SNS Topic ARN for budget alerts',
      exportName: `${amplifyProjectInfo.projectName}-BudgetAlertTopicArn-${cdk.Fn.ref('env')}`,
    });

    // 2. SNS Topic for Monthly Reports
    const monthlyReportTopic = new sns.Topic(this, 'MonthlyReportTopic', {
      topicName: `finance-monthly-reports-${cdk.Fn.ref('env')}`,
      displayName: 'Finance Tracker Monthly Reports',
    });

    // Note: Email subscriptions will be managed dynamically by Lambda
    // when users click the email button (allows any user to subscribe)

    new cdk.CfnOutput(this, 'MonthlyReportTopicArn', {
      value: monthlyReportTopic.topicArn,
      description: 'SNS Topic ARN for monthly reports',
      exportName: `${amplifyProjectInfo.projectName}-MonthlyReportTopicArn-${cdk.Fn.ref('env')}`,
    });

    // 3. Add tags for resource organization
    cdk.Tags.of(this).add('Project', 'FinanceTracker');
    cdk.Tags.of(this).add('Environment', cdk.Fn.ref('env'));
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
