import { waitForTask } from '../../src/api-wrapper'
// we use the Octopus API client to setup and teardown integration test data, it doesn't form part of create-release-action at this point
import { PackageRequirement, ProjectResource, RunCondition, StartTrigger } from '@octopusdeploy/message-contracts'
import {
  Client,
  ClientConfiguration,
  CreateDeploymentUntenantedCommandV1,
  createRelease,
  CreateReleaseCommandV1,
  DeploymentEnvironment,
  deployReleaseUntenanted,
  EnvironmentRepository,
  Logger,
  Repository
} from '@octopusdeploy/api-client'
import { randomBytes } from 'crypto'
import { CleanupHelper } from './cleanup-helper'
import { RunConditionForAction } from '@octopusdeploy/message-contracts/dist/runConditionForAction'
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
  instanceURL: process.env.OCTOPUS_TEST_URL || 'http://localhost:8050',
  space: process.env.OCTOPUS_TEST_SPACE || 'Default'
}

const runId = randomBytes(16).toString('hex')
const localProjectName = `project${runId}`
let localServerTaskId = ''

async function createReleaseForTest(client: Client): Promise<string> {
  client.info('Creating a release in Octopus Deploy...')

  const command: CreateReleaseCommandV1 = {
    spaceName: apiClientConfig.space || 'Default',
    projectName: localProjectName
  }

  const allocatedReleaseNumber = await createRelease(client, command)

  client.info(`Release ${allocatedReleaseNumber.releaseVersion} created successfully!`)

  return allocatedReleaseNumber.releaseVersion
}

async function deployReleaseForTest(client: Client, releaseNumber: string): Promise<string> {
  client.info('Deploying release in Octopus Deploy...')

  const command: CreateDeploymentUntenantedCommandV1 = {
    spaceName: apiClientConfig.space || 'Default',
    projectName: localProjectName,
    releaseVersion: releaseNumber,
    environmentNames: ['Dev']
  }

  const serverTasks = await deployReleaseUntenanted(client, command)

  client.info(`Deployment for ${releaseNumber} created successfully!`)

  return serverTasks[0].serverTaskId
}

describe('integration tests', () => {
  jest.setTimeout(100000)

  const globalCleanup = new CleanupHelper()

  const standardInputParameters: InputParameters = {
    server: apiClientConfig.instanceURL,
    apiKey: apiClientConfig.apiKey,
    space: apiClientConfig.space || 'Default',
    serverTaskId: ''
  }

  let apiClient: Client
  let repository: Repository
  let project: ProjectResource

  beforeAll(async () => {
    apiClient = await Client.create({ autoConnect: true, ...apiClientConfig })

    repository = new Repository(apiClient)

    // pre-reqs: We need a project, which needs to have a deployment process

    const projectGroup = (await repository.projectGroups.all())[0]
    if (!projectGroup) throw new Error("Can't find first projectGroup")

    let devEnv: DeploymentEnvironment
    const envRepository = new EnvironmentRepository(apiClient, apiClientConfig.space || 'Default')
    const envs = await envRepository.list({ partialName: 'Dev' })
    if (envs.items.length === 1) {
      devEnv = envs.items[0]
    } else {
      devEnv = await envRepository.create({ name: 'Dev' })
    }

    const lifeCycle = (await repository.lifecycles.all())[0]
    if (!lifeCycle) throw new Error("Can't find first lifecycle")
    if (lifeCycle.Phases.length === 0) {
      lifeCycle.Phases.push({
        Id: 'test',
        Name: 'Testing',
        OptionalDeploymentTargets: [devEnv.id],
        AutomaticDeploymentTargets: [],
        MinimumEnvironmentsBeforePromotion: 1,
        IsOptionalPhase: false
      })
      await repository.lifecycles.modify(lifeCycle)
    }

    project = await repository.projects.create({
      Name: localProjectName,
      LifecycleId: lifeCycle.Id,
      ProjectGroupId: projectGroup.Id
    })

    const deploymentProcess = await repository.deploymentProcesses.get(project.DeploymentProcessId, undefined)
    deploymentProcess.Steps = [
      {
        Condition: RunCondition.Success,
        Links: {},
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
            },
            Links: {}
          }
        ]
      }
    ]

    await repository.deploymentProcesses.saveToProject(project, deploymentProcess)
  })

  afterAll(async () => {
    if (process.env.GITHUB_ACTIONS) {
      // Sneaky: if we are running inside github actions, we *do not* cleanup the octopus server project data.
      // rather, we leave it lying around and setOutput the random project name so the GHA self-test can use it
      setOutput('gha_selftest_server_task_id', localServerTaskId)
    } else {
      await repository.projects.del(project)
      globalCleanup.cleanup()
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

    // The first release in the project, so it should always have 0.0.1
    expect(result).toBe(true)
    expect(output.getAllMessages()).toContain(
      `[INFO] 🐙 waiting for task [${standardInputParameters.serverTaskId}](${standardInputParameters.server}/app#/${repository.spaceId}/tasks/${standardInputParameters.serverTaskId}) in Octopus Deploy...`
    )

    // deploy again, so we get a different task id for the self test in the workflow
    serverTaskId = await deployReleaseForTest(client, releaseNumber)
    localServerTaskId = serverTaskId
  })
})
