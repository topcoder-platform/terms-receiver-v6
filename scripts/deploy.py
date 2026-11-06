#!/usr/bin/env python3
"""Release a prebuilt Terms image using the pinned OIDC deployment suite."""
import argparse
import json
import os
from pathlib import Path
import re
import sys
import tempfile

sys.path.insert(0, '/tmp/tc-deploy-scripts')
import tcdeploy as d

APP = 'terms-receiver-v6'
CONTAINER = 'terms-service-container'
ROOT = Path(__file__).resolve().parents[1]


def validate_runtime(task, manifest):
    """Check references only; the deployment identity cannot read secret values."""
    prefix = f'/config/{APP}/appvar/'
    arn_prefix = f"arn:aws:ssm:{manifest['region']}:{manifest['accountId']}:parameter"
    application = []
    for container in task['containerDefinitions']:
        d.require(not container.get('environment'), 'Application configuration must use SSM secrets')
        for secret in container.get('secrets', []):
            reference = secret['valueFrom'].removeprefix(arn_prefix)
            d.require(reference.startswith(prefix) and len(reference) > len(prefix),
                      'Runtime parameters must use the service SSM namespace')
        if container['name'] == CONTAINER:
            application.append(container)
    d.require(len(application) == 1, 'Expected exactly one Terms application container')
    if APP == 'terms-service-v6':
        audience = [s for s in application[0].get('secrets', []) if s['name'] == 'JWT_AUDIENCE']
        d.require(len(audience) == 1 and
                  audience[0]['valueFrom'].removeprefix(arn_prefix) == prefix + 'JWT_AUDIENCE',
                  'Bind JWT_AUDIENCE to the service browser audience parameter before deployment')


class RuntimeCheckedAWS:
    """Retain Terms-specific gates on every task snapshot used by the suite."""
    def __init__(self, aws, manifest):
        self.aws = aws
        self.manifest = manifest
        self.env = aws.env

    def call(self, service, operation, **kwargs):
        response = self.aws.call(service, operation, **kwargs)
        if service == 'ecs' and operation == 'describe-task-definition':
            validate_runtime(response['taskDefinition'], self.manifest)
        return response


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest')
    args = parser.parse_args(argv)
    manifest = d.read_manifest(args.manifest)
    d.require(manifest['service'] == APP and manifest['taskFamily'] == APP and
              manifest['repository'] == 'github.com/topcoder-platform/' + APP and
              manifest['images'] == {CONTAINER: APP}, 'Unexpected Terms deployment manifest')
    d.require(os.environ.get('CIRCLE_BRANCH') == manifest['branch'] and not os.environ.get('CIRCLE_TAG'),
              'Only the configured branch may deploy; tag pipelines are forbidden')
    d.require(os.environ.get('CIRCLE_PROJECT_USERNAME', '') + '/' +
              os.environ.get('CIRCLE_PROJECT_REPONAME', '') == 'topcoder-platform/' + APP,
              'CircleCI repository differs from manifest')
    release = os.environ.get('CIRCLE_SHA1', '') + '-' + os.environ.get('CIRCLE_BUILD_NUM', '')
    d.require(re.fullmatch(r'[a-f0-9]{40}-[0-9]{1,12}', release), 'Invalid release identity')
    checks = d.validate_health_checks(manifest, json.loads((ROOT / 'deploy/health-checks.json').read_text()))
    aws = RuntimeCheckedAWS(d.authenticate(manifest, os.environ.get('CIRCLE_OIDC_TOKEN_V3')), manifest)
    with tempfile.TemporaryDirectory(prefix='terms-release-') as directory:
        result = d.deploy(aws, manifest, {CONTAINER: APP + ':candidate'}, release,
                          d.Publisher(aws, manifest, directory), checks)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (d.DeployError, ValueError, KeyError, TypeError, OSError):
        # Never relay raw cloud responses, subprocess output, or secret values.
        error = sys.exc_info()[1]
        print('Deployment stopped: ' + (str(error) if isinstance(error, d.DeployError)
                                      else 'invalid input or response'), file=sys.stderr)
        sys.exit(1)
