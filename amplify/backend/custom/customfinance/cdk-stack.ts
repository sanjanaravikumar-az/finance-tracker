import * as cdk from 'aws-cdk-lib';
import * as AmplifyHelpers from '@aws-amplify/cli-extensibility-helper';
import { AmplifyDependentResourcesAttributes } from '../../types/amplify-dependent-resources-ref';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class cdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps, amplifyResourceProps?: AmplifyHelpers.AmplifyResourceProps) {
    super(scope, id, props);
    
    /* Do not remove - Amplify CLI automatically injects the current deployment environment in this input parameter */
    new cdk.CfnParameter(this, 'env', {
      type: 'String',
      description: 'Current Amplify CLI env name',
    });

    const amplifyProjectInfo = AmplifyHelpers.getProjectInfo();

    // 1. SNS Topic for Budget Alerts
    const budgetAlertTopic = new sns.Topic(this, 'BudgetAlertTopic', {
      topicName: `finance-budget-alerts-${cdk.Fn.ref('env')}`,
      displayName: 'Finance Tracker Budget Alerts',
    });

    // Output the SNS topic ARN for use in the app
    new cdk.CfnOutput(this, 'BudgetAlertTopicArn', {
      value: budgetAlertTopic.topicArn,
      description: 'SNS Topic ARN for budget alerts',
      exportName: `${amplifyProjectInfo.projectName}-BudgetAlertTopicArn-${cdk.Fn.ref('env')}`,
    });

    // 2. EventBridge Rule for Monthly Reports (runs on 1st of each month at 9 AM UTC)
    const monthlyReportRule = new events.Rule(this, 'MonthlyReportRule', {
      ruleName: `finance-monthly-report-${cdk.Fn.ref('env')}`,
      description: 'Triggers monthly financial report generation',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '9',
        day: '1',
        month: '*',
        year: '*',
      }),
    });

    // Output the EventBridge rule ARN
    new cdk.CfnOutput(this, 'MonthlyReportRuleArn', {
      value: monthlyReportRule.ruleArn,
      description: 'EventBridge Rule ARN for monthly reports',
      exportName: `${amplifyProjectInfo.projectName}-MonthlyReportRuleArn-${cdk.Fn.ref('env')}`,
    });

    // 3. SNS Topic for Monthly Reports
    const monthlyReportTopic = new sns.Topic(this, 'MonthlyReportTopic', {
      topicName: `finance-monthly-reports-${cdk.Fn.ref('env')}`,
      displayName: 'Finance Tracker Monthly Reports',
    });

    // Connect EventBridge rule to SNS topic
    monthlyReportRule.addTarget(new targets.SnsTopic(monthlyReportTopic));

    new cdk.CfnOutput(this, 'MonthlyReportTopicArn', {
      value: monthlyReportTopic.topicArn,
      description: 'SNS Topic ARN for monthly reports',
      exportName: `${amplifyProjectInfo.projectName}-MonthlyReportTopicArn-${cdk.Fn.ref('env')}`,
    });

    // 4. Add tags for resource organization
    cdk.Tags.of(this).add('Project', 'FinanceTracker');
    cdk.Tags.of(this).add('Environment', cdk.Fn.ref('env'));
    cdk.Tags.of(this).add('ManagedBy', 'Amplify');
  }
}
