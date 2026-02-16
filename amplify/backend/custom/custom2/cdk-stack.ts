import * as cdk from 'aws-cdk-lib';
import * as AmplifyHelpers from '@aws-amplify/cli-extensibility-helper';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';

export class cdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps, amplifyResourceProps?: AmplifyHelpers.AmplifyResourceProps) {
    super(scope, id, props);

    /* Do not remove - Amplify CLI automatically injects the current deployment environment in this input parameter */
    new cdk.CfnParameter(this, 'env', {
      type: 'String',
      description: 'Current Amplify CLI env name',
    });

    const amplifyProjectInfo = AmplifyHelpers.getProjectInfo();

    // Simple SQS queue for testing custom resources
    const queue = new sqs.Queue(this, 'FinanceQueue', {
      queueName: `finance-queue-${cdk.Fn.ref('env')}`,
      retentionPeriod: cdk.Duration.days(7),
      visibilityTimeout: cdk.Duration.seconds(30),
    });

    new cdk.CfnOutput(this, 'QueueUrl', {
      value: queue.queueUrl,
      description: 'SQS Queue URL',
    });

    new cdk.CfnOutput(this, 'QueueArn', {
      value: queue.queueArn,
      description: 'SQS Queue ARN',
    });

    cdk.Tags.of(this).add('Project', 'FinanceTracker');
    cdk.Tags.of(this).add('Environment', cdk.Fn.ref('env'));
  }
}
