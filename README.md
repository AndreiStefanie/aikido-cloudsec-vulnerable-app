# aikido-cloudsec-vulnerable-app

Purposefully vulnerable workshop stack that demonstrates how an attacker can abuse an SSRF bug on an IMDSv1 EC2 instance, steal IAM credentials from the instance profile, and use those credentials to recover a code stored in S3.

## Architecture

The repo is split into two main parts:

- `app/`: a minimal Node/Express service that looks like a lifecycle data lookup tool but includes a deliberately unsafe server-side fetch endpoint
- `infra/`: a CloudFormation stack that deploys the app to a public EC2 instance, enables IMDSv1 access, and provisions the S3 bucket plus code object

The intended attendee path is:

1. Open the public app URL.
2. Discover and abuse the SSRF-capable preview endpoint.
3. Query IMDSv1 on `169.254.169.254` to retrieve the EC2 instance-profile credentials.
4. Use the stolen credentials to enumerate S3 buckets and read the text file stored in the workshop bucket.

## App Behavior

The attendee-facing service exposes:

- `GET /`: landing page with curated `endoflife.date` lifecycle feeds and a custom source field
- `GET /fetch?url=...`: intentionally vulnerable server-side fetch endpoint that returns upstream response metadata and body as JSON

The default experience fetches public JSON feeds such as `https://endoflife.date/api/python.json`, but the app does not restrict link-local addresses or custom targets. Requests to the EC2 metadata service therefore succeed when the app runs on an instance with IMDSv1 available.

Nginx serves the attendee-facing site on port `80` and proxies requests to the Node process on the internal `AppPort`.

Configurable environment variables:

- `PORT`
- `APP_TITLE`
- `APP_SUBTITLE`
- `WORKSHOP_HINT`

See [app/.env.example](/Users/andrei/projects/aikido/aikido-cloudsec-vulnerable-app/app/.env.example) for the defaults used locally or by other deployment methods.

## Deployment

The CloudFormation template lives at [infra/template.yaml](/Users/andrei/projects/aikido/aikido-cloudsec-vulnerable-app/infra/template.yaml). It creates:

- one public EC2 instance running Amazon Linux 2023
- one security group exposing port `80`
- one instance profile with tightly scoped S3 read permissions
- one S3 bucket with an obvious workshop-oriented name
- no S3 object content by default; you upload the code file manually after the stack is created

### Required Parameters

At minimum, set:

- `VpcId`: your default VPC ID
- `SubnetId`: a public subnet ID from that default VPC
- `AppRepositoryRef`: a branch or tag that contains the version of this repo you want the instance to clone

`AppRepositoryUrl` defaults to this GitHub repository. If you deploy from a fork or another mirror, override it.

### Example Deploy Command

```bash
aws cloudformation deploy \
  --stack-name aikido-cloudsec-workshop \
  --template-file infra/template.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    VpcId='vpc-xxxxxxxx' \
    SubnetId='subnet-xxxxxxxx' \
    AppRepositoryRef='main'
```

After the stack finishes:

1. Open the `AppUrl` output to confirm the landing page is reachable.
2. Upload your text file to the bucket from the `WorkshopBucketName` output.
3. Point DNS at the `PublicIp` Elastic IP output if you want attendees to use a hostname.
4. Distribute only the public URL or IP to attendees.

## Maintainer Notes

The workshop bucket name is generated as `<account-id>-<region>-<suffix>`, where the suffix defaults to `cloudsec-workshop-code`. Upload the workshop code file yourself after deployment.

The EC2 instance profile is intentionally scoped so exfiltrated credentials can:

- list S3 buckets in the account
- list objects in the workshop bucket
- read any object in the workshop bucket

It cannot write objects or broadly enumerate other AWS services.

The stack bootstraps the application by cloning this repository onto the EC2 instance and installing the Node dependencies from `app/package.json`. Push the desired branch or tag before deployment so the instance can retrieve the correct version.

## Workshop Validation

To validate the scenario after deployment:

1. Open the attendee-facing app URL.
2. Use the lifecycle fetch feature to request IMDS paths under `/latest/meta-data/iam/security-credentials/`.
3. Recover the temporary AWS credentials from the role credentials document.
4. Use those credentials with the AWS CLI to list buckets and read the workshop code object you uploaded.

## Cleanup

Delete the stack when the workshop is complete:

```bash
aws cloudformation delete-stack --stack-name aikido-cloudsec-workshop
```

Additional infrastructure details are documented in [infra/README.md](/Users/andrei/projects/aikido/aikido-cloudsec-vulnerable-app/infra/README.md).
