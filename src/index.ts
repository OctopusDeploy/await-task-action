import { getInputParameters } from './input-parameters'
import { debug, info, warning, error, setFailed, setOutput, isDebug } from '@actions/core'
import { writeFileSync } from 'fs'
import { Client, ClientConfiguration, Logger } from '@octopusdeploy/api-client'
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

    const completedSuccessfully = await waitForTask(client, parameters)

    setOutput('completed_successfully', completedSuccessfully)

    const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY
    if (stepSummaryFile) {
      writeFileSync(
        stepSummaryFile,
        `🐙 Octopus Deploy task ${completedSuccessfully ? 'completed successfully' : 'did not complete successfully'}.`
      )
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      setFailed(e)
    }
  }
})()
