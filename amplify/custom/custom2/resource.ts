import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
const branchName = process.env.AWS_BRANCH ?? "sandbox";
const projectName = "financetracker";
export class cdkStack extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);
        /* Do not remove - Amplify CLI automatically injects the current deployment environment in this input parameter */
        new cdk.CfnParameter(this, "env", {
            type: "String",
            description: "Current Amplify CLI env name",
            default: `${branchName}`
        });
        // Simple SQS queue for testing custom resources
        const queue = new sqs.Queue(this, 'FinanceQueue', {
            queueName: `finance-queue-${branchName}`,
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
        cdk.Tags.of(this).add('Environment', branchName);
    }
}
