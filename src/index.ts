import { getInputParameters } from './input-parameters'
import { debug, info, warning, error, setFailed, setOutput, isDebug, summary } from '@actions/core'
import { Client, ClientConfiguration, Logger, TaskState } from '@octopusdeploy/api-client'
import { waitForTask } from './api-wrapper'
import { buildStepSummary } from './summary'

// GitHub actions  entrypoint
;(async (): Promise<void> => {
  try {
    const logger: Logger = {
      debug: message => {
        if (isDebug()) {
          debug(message)
        }
      },
      info: message => info(message),
      warn: message => warning(message),
      error: (message, err) => {
        if (err !== undefined) {
          error(err.message)
        } else {
          error(message)
        }
      }
    }

    const parameters = getInputParameters()

    const config: ClientConfiguration = {
      userAgentApp: 'GitHubActions await-task-action',
      instanceURL: parameters.server,
      apiKey: parameters.apiKey,
      accessToken: parameters.accessToken,
      logging: logger
    }

    const client = await Client.create(config)

    const { state: taskState, task, taskUrl } = await waitForTask(client, parameters)

    setOutput('task_state', taskState)
    info(`🐙 View the task log in Octopus Deploy: ${taskUrl}`)

    if (process.env.GITHUB_STEP_SUMMARY) {
      await summary.addRaw(buildStepSummary(parameters.serverTaskId, taskUrl, task)).write()
    }

    if (taskState !== TaskState.Success) {
      if (taskState) {
        setFailed(`🐙 Octopus Deploy task did not complete successfully (state: ${taskState})`)
      } else {
        setFailed('🐙 Could not determine Octopus Deploy task state')
      }
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      setFailed(e)
    } else {
      setFailed(`Unknown error: ${e}`)
    }
  }
})()
