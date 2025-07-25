import { waitForTask } from '../../src/api-wrapper'
// we use the Octopus API client to setup and teardown integration test data, it doesn't form part of create-release-action at this point
import {
  Client,
  ClientConfiguration,
  CreateDeploymentUntenantedCommandV1,
  CreateReleaseCommandV1,
  DeploymentEnvironment,
  DeploymentProcessRepository,
  DeploymentRepository,
  EnvironmentRepository,
  LifecycleRepository,
  Logger,
  PackageRequirement,
  Project,
  ProjectGroupRepository,
  ProjectRepository,
  ReleaseRepository,
  RunCondition,
  RunConditionForAction,
  SpaceRepository,
  StartTrigger,
  TaskState
} from '@octopusdeploy/api-client'
import { randomBytes } from 'crypto'
import { setOutput } from '@actions/core'
import { CaptureOutput } from '../test-helpers'
import { InputParameters } from '../../src/input-parameters'

// NOTE: These tests assume Octopus is running and connectable.
// In the build pipeline they are run as part of a build.yml file which populates
// OCTOPUS_TEST_URL and OCTOPUS_TEST_API_KEY environment variables pointing to docker
// containers that are also running. AND it assumes that 'octo' is in your PATH
//
// If you want to run these locally outside the build pipeline, you need to launch
// octopus yourself, and set OCTOPUS_TEST_CLI_PATH, OCTOPUS_TEST_URL and OCTOPUS_TEST_API_KEY appropriately,
// and put octo in your path somewhere.
// all resources created by this script have a GUID in
// their name so we they don't clash with prior test runs

const apiClientConfig: ClientConfiguration = {
  userAgentApp: 'Test',
  apiKey: process.env.OCTOPUS_TEST_API_KEY || 'API-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  instanceURL: process.env.OCTOPUS_TEST_URL || 'http://localhost:8050'
}

const runId = randomBytes(16).toString('hex')
const localProjectName = `project${runId}`
const spaceName = process.env.OCTOPUS_TEST_SPACE || 'Default'
let localServerTaskId = ''

async function createReleaseForTest(client: Client): Promise<string> {
  client.info('Creating a release in Octopus Deploy...')

  const command: CreateReleaseCommandV1 = {
    spaceName,
    ProjectName: localProjectName
  }

  const releaseRepository = new ReleaseRepository(client, command.spaceName)
  const allocatedReleaseNumber = await releaseRepository.create(command)

  client.info(`Release ${allocatedReleaseNumber.ReleaseVersion} created successfully!`)

  return allocatedReleaseNumber.ReleaseVersion
}

async function deployReleaseForTest(client: Client, releaseNumber: string): Promise<string> {
  client.info('Deploying release in Octopus Deploy...')

  const command: CreateDeploymentUntenantedCommandV1 = {
    spaceName,
    ProjectName: localProjectName,
    ReleaseVersion: releaseNumber,
    EnvironmentNames: ['Dev']
  }

  const releaseRepository = new DeploymentRepository(client, command.spaceName)
  const serverTasks = await releaseRepository.create(command)

  client.info(`Deployment for ${releaseNumber} created successfully!`)

  return serverTasks.DeploymentServerTasks[0].ServerTaskId
}

describe('integration tests', () => {
  jest.setTimeout(100000)

  const standardInputParameters: InputParameters = {
    server: apiClientConfig.instanceURL,
    apiKey: apiClientConfig.apiKey,
    space: spaceName,
    serverTaskId: '',
    pollingInterval: 10,
    timeout: 600,
    hideProgress: false,
    cancelOnTimeout: false
  }

  let apiClient: Client
  let project: Project

  beforeAll(async () => {
    apiClient = await Client.create(apiClientConfig)

    // pre-reqs: We need a project, which needs to have a deployment process

    const projectGroup = (await new ProjectGroupRepository(apiClient, standardInputParameters.space).list({ take: 1 }))
      .Items[0]
    if (!projectGroup) throw new Error("Can't find first projectGroup")

    let devEnv: DeploymentEnvironment
    const envRepository = new EnvironmentRepository(apiClient, spaceName)
    const envs = await envRepository.list({ partialName: 'Dev' })
    if (envs.Items.filter(e => e.Name === 'Dev').length === 1) {
      devEnv = envs.Items.filter(e => e.Name === 'Dev')[0]
    } else {
      devEnv = await envRepository.create({ Name: 'Dev' })
    }

    const lifecycleRepository = new LifecycleRepository(apiClient, standardInputParameters.space)
    const lifecycle = (await lifecycleRepository.list({ take: 1 })).Items[0]
    if (!lifecycle) throw new Error("Can't find first lifecycle")
    if (lifecycle.Phases.length === 0) {
      lifecycle.Phases.push({
        Id: 'test',
        Name: 'Testing',
        OptionalDeploymentTargets: [devEnv.Id],
        AutomaticDeploymentTargets: [],
        MinimumEnvironmentsBeforePromotion: 1,
        IsOptionalPhase: false
      })
      await lifecycleRepository.modify(lifecycle)
    }

    const projectRepository = new ProjectRepository(apiClient, standardInputParameters.space)
    project = await projectRepository.create({
      Name: localProjectName,
      LifecycleId: lifecycle.Id,
      ProjectGroupId: projectGroup.Id
    })

    const deploymentProcessRepository = new DeploymentProcessRepository(apiClient, standardInputParameters.space)
    const deploymentProcess = await deploymentProcessRepository.get(project)
    deploymentProcess.Steps = [
      {
        Condition: RunCondition.Success,
        PackageRequirement: PackageRequirement.LetOctopusDecide,
        StartTrigger: StartTrigger.StartAfterPrevious,
        Id: '',
        Name: `step1-${runId}`,
        Properties: {},
        Actions: [
          {
            Id: '',
            Name: 'Run a Script',
            ActionType: 'Octopus.Script',
            Notes: null,
            IsDisabled: false,
            CanBeUsedForProjectVersioning: false,
            IsRequired: false,
            WorkerPoolId: null,
            Container: {
              Image: null,
              FeedId: null
            },
            WorkerPoolVariable: '',
            Environments: [],
            ExcludedEnvironments: [],
            Channels: [],
            TenantTags: [],
            Packages: [],
            Condition: RunConditionForAction.Success,
            Properties: {
              'Octopus.Action.RunOnServer': 'true',
              'Octopus.Action.Script.ScriptSource': 'Inline',
              'Octopus.Action.Script.Syntax': 'PowerShell',
              'Octopus.Action.Script.ScriptBody': "Write-Host 'hello'"
            }
          }
        ]
      }
    ]

    await deploymentProcessRepository.update(project, deploymentProcess)
  })

  afterAll(() => {
    if (process.env.GITHUB_ACTIONS) {
      // Sneaky: if we are running inside github actions, we *do not* cleanup the octopus server project data.
      // rather, we leave it lying around and setOutput the random project name so the GHA self-test can use it
      setOutput('gha_selftest_server_task_id', localServerTaskId)
    }
  })

  test('can wait for a deployment', async () => {
    const output = new CaptureOutput()

    const logger: Logger = {
      debug: message => output.debug(message),
      info: message => output.info(message),
      warn: message => output.warn(message),
      error: (message, err) => {
        if (err !== undefined) {
          output.error(err.message)
        } else {
          output.error(message)
        }
      }
    }

    const config: ClientConfiguration = {
      userAgentApp: 'Test',
      instanceURL: apiClientConfig.instanceURL,
      apiKey: apiClientConfig.apiKey,
      logging: logger
    }

    const client = await Client.create(config)

    const releaseNumber = await createReleaseForTest(client)
    let serverTaskId = await deployReleaseForTest(client, releaseNumber)
    standardInputParameters.serverTaskId = serverTaskId
    const result = await waitForTask(client, standardInputParameters)

    const spaceRepository = new SpaceRepository(client)
    const space = (await spaceRepository.list({ partialName: spaceName })).Items[0]

    // The first release in the project, so it should always have 0.0.1
    expect(result).toBe(TaskState.Success)
    expect(output.getAllMessages()).toContain(
      `[INFO] 🐙 waiting for task ${standardInputParameters.server}/app#/${space.Id}/tasks/${standardInputParameters.serverTaskId} in Octopus Deploy...`
    )

    // re-queue another deployment to the same environment, which the self test is going to wait for via localServerTaskId
    serverTaskId = await deployReleaseForTest(client, releaseNumber)
    localServerTaskId = serverTaskId
  })
})
