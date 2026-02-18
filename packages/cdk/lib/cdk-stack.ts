import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC（検証用）
    const vpc = new ec2.Vpc(this, 'DevVpc', {
      maxAzs: 2,
      natGateways: 0,
      vpcName: 'test-vpc',
    });

    // SSM 用 VPC Endpoint
    vpc.addInterfaceEndpoint('SSMEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
    });
    vpc.addInterfaceEndpoint('SSMMessagesEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
    });
    vpc.addInterfaceEndpoint('EC2MessagesEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
    });

    // Aurora Serverless v2 クラスター
    const dbName = 'dev';
    const cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_8, // LTS版
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      serverlessV2MinCapacity: 0,
      serverlessV2MaxCapacity: 2,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      defaultDatabaseName: dbName,
      enableDataApi: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発用
    });

    // 踏み台 EC2（BastionHostLinux）
    const bastionHost = new ec2.BastionHostLinux(this, 'BastionHost', {
      vpc,
      subnetSelection: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.NANO,
      ),
      blockDevices: [
        {
          deviceName: '/dev/sdf',
          volume: ec2.BlockDeviceVolume.ebs(8, {
            encrypted: true,
          }),
        },
      ],
    });

    // Aurora への接続を許可
    cluster.connections.allowDefaultPortFrom(bastionHost);

    // 接続情報を出力
    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      value: cluster.clusterEndpoint.hostname,
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: cluster.secret?.secretArn || '',
    });

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: cluster.clusterArn,
    });

    new cdk.CfnOutput(this, 'PortForwardCommand', {
      value: `aws ssm start-session --region ${this.region} --target ${bastionHost.instanceId} --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters '{"portNumber":["${cluster.clusterEndpoint.port}"], "localPortNumber":["${cluster.clusterEndpoint.port}"], "host": ["${cluster.clusterEndpoint.hostname}"]}'`,
      description: 'SSM ポートフォワーディングコマンド',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretsCommand', {
      value: `aws secretsmanager get-secret-value --secret-id ${cluster.secret?.secretName} --region ${this.region}`,
      description: 'DB 認証情報取得コマンド',
    });

    // Lambda関数（FastAPI）
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.PYTHON_3_14,
      architecture: lambda.Architecture.ARM_64,
      handler: 'src/main.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../api'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_14.bundlingImage,
          platform: 'linux/arm64',
          environment: {
            UV_CACHE_DIR: '/tmp/uv-cache',
          },
          volumes: [
            {
              hostPath: path.join(__dirname, '../../db'),
              containerPath: '/shared-input',
            },
          ],
          command: ['bash', '/asset-input/build.sh'],
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      environment: {
        DATABASE_URL: this.buildDatabaseUrl(
          cluster.secret ??
            (() => {
              throw new Error('cluster.secret is undefined');
            })(),
          cluster.clusterEndpoint,
          dbName,
        ),
      },
    });

    // Lambda から Aurora への接続を許可
    cluster.connections.allowDefaultPortFrom(apiFunction);

    // API Gateway（REST API）
    const api = new apigateway.LambdaRestApi(this, 'ApiGateway', {
      handler: apiFunction,
      proxy: true,
      restApiName: 'Python-RDS-Serverless-Template',
      description: 'RDSを操作するAPIのテンプレート',
      deployOptions: {
        stageName: 'dev',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
    });

    // API Gateway URL を出力
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });
  }

  private buildDatabaseUrl(
    secret: cdk.aws_secretsmanager.ISecret,
    endpoint: rds.Endpoint,
    dbName: string,
  ): string {
    const username = secret.secretValueFromJson('username').unsafeUnwrap();
    const password = secret.secretValueFromJson('password').unsafeUnwrap();
    return `postgresql+psycopg://${username}:${password}@${endpoint.hostname}:${endpoint.port}/${dbName}`;
  }
}
