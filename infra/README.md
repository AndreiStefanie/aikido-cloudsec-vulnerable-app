# Infrastructure Notes

This stack deploys a single public EC2 instance running the vulnerable app, an empty S3 bucket for the workshop code object, and the minimal IAM permissions required for attendees to enumerate buckets and read that object after stealing the instance-profile credentials.

## Parameters

- `VpcId`: VPC used by the workshop host. Select the default VPC.
- `SubnetId`: public subnet used by the workshop host. Select a subnet from the default VPC that assigns public IPv4 addresses.
- `InstanceType`: EC2 instance size for the workshop host. Default: `t3.micro`
- `KeyName`: optional EC2 key pair name for SSH access. Leave blank to skip SSH key attachment.
- `AppPort`: internal TCP port used by the Express app behind Nginx. Default: `3000`
- `AppRepositoryUrl`: public Git URL cloned onto the EC2 instance during bootstrap.
- `AppRepositoryRef`: branch or tag checked out during bootstrap.
- `DomainName`: public DNS name that points at the Elastic IP and is used by Nginx. Default: `eol.rsa.aikido-security.com`
- `WorkshopBucketName`: globally unique S3 bucket name used for the workshop code file.
- `AppTitle`, `AppSubtitle`, `WorkshopHint`: copy injected into the landing page.

## Outputs

- `AppUrl`: direct HTTP entrypoint for workshop attendees
- `PublicIp`: Elastic IP attached to the workshop host, useful before DNS is configured
- `DomainNameOutput`: DNS name configured for the attendee-facing site
- `WorkshopBucketName`: bucket that stores the workshop code object

## Deployment Shape

- The template expects you to pass the default `VpcId` and a public `SubnetId` from that VPC.
- The EC2 instance is launched with IMDS enabled and `HttpTokens=optional`, which leaves IMDSv1 reachable from the instance.
- The instance ENI explicitly associates a public IP address, and the stack also allocates an Elastic IP so the attendee entrypoint stays stable.
- Nginx listens on port `80` and proxies requests to the Node app on `AppPort`.
- The security group allows both `80` and `443` so the instance is ready for Let's Encrypt or another on-instance TLS setup.
- The instance profile grants:
  - `s3:ListAllMyBuckets`
  - `s3:ListBucket` on the workshop bucket
  - `s3:GetObject` on any object in the workshop bucket
- After stack creation, upload the workshop code file manually to the bucket.
