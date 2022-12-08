import { getInputParameters } from './input-parameters'
import { debug, info, warning, error, setFailed, setOutput, isDebug } from '@actions/core'
import { writeFileSync } from 'fs'
import { Client, ClientConfiguration, Logger, TaskState } from '@octopusdeploy/api-client'
import { waitForTask } from './api-wrapper'

// GitHub actions entrypoint
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
      logging: logger
    }

    const client = await Client.create(config)

    const taskState = await waitForTask(client, parameters)

    setOutput('task_state', taskState && 'unknown')

    const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY
    if (stepSummaryFile) {
      writeFileSync(
        stepSummaryFile,
        `🐙 Octopus Deploy task ${
          taskState === TaskState.Success ? 'completed successfully' : 'did not complete successfully'
        }.`
      )
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
