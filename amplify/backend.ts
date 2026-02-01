import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";
import { financetrackere30b1453 } from "./function/financetrackere30b1453/resource";
import { defineBackend } from "@aws-amplify/backend";
import { Duration } from "aws-cdk-lib";
import { cdkStack as customfinance } from "./custom/customfinance/resource";
const backend = defineBackend({
    auth,
    data,
    storage,
    financetrackere30b1453
});
const cfnUserPool = backend.auth.resources.cfnResources.cfnUserPool;
cfnUserPool.usernameAttributes = ["email"];
cfnUserPool.policies = {
    passwordPolicy: {
        minimumLength: 8,
        requireUppercase: false,
        requireLowercase: false,
        requireNumbers: false,
        requireSymbols: false,
        temporaryPasswordValidityDays: 7
    }
};
const userPool = backend.auth.resources.userPool;
userPool.addClient("NativeAppClient", {
    refreshTokenValidity: Duration.days(30),
    disableOAuth: true,
    enableTokenRevocation: true,
    enablePropagateAdditionalUserContextData: false,
    authSessionValidity: Duration.minutes(3),
    generateSecret: false
});
const s3Bucket = backend.storage.resources.cfnResources.cfnBucket;
// Use this bucket name post refactor
// s3Bucket.bucketName = 'financetrackerd28ba5967ba1457a889f86f1c898a7c029933-main';
s3Bucket.bucketEncryption = {
    serverSideEncryptionConfiguration: [
        {
            serverSideEncryptionByDefault: {
                sseAlgorithm: "AES256"
            },
            bucketKeyEnabled: false
        }
    ]
};
const branchName = process.env.AWS_BRANCH ?? "sandbox";
backend.financetrackere30b1453.resources.cfnResources.cfnFunction.functionName = `financetrackere30b1453-${branchName}`;
backend.financetrackere30b1453.addEnvironment("API_FINANCETRACKER_GRAPHQLAPIKEYOUTPUT", backend.data.apiKey!);
backend.financetrackere30b1453.addEnvironment("API_FINANCETRACKER_GRAPHQLAPIENDPOINTOUTPUT", backend.data.graphqlUrl);
backend.financetrackere30b1453.addEnvironment("API_FINANCETRACKER_GRAPHQLAPIIDOUTPUT", backend.data.apiId);
backend.financetrackere30b1453.addEnvironment("API_FINANCETRACKER_TRANSACTIONTABLE_NAME", backend.data.resources.tables["Transaction"].tableName);
backend.financetrackere30b1453.addEnvironment("AUTH_FINANCETRACKERB192A2D4_USERPOOLID", backend.auth.resources.userPool.userPoolId);
backend.data.resources.graphqlApi.grantQuery(backend.financetrackere30b1453.resources.lambda);
backend.data.resources.graphqlApi.grantMutation(backend.financetrackere30b1453.resources.lambda);
backend.data.resources.graphqlApi.grantSubscription(backend.financetrackere30b1453.resources.lambda);
new customfinance(backend.createStack("customfinance"), "customfinance");
