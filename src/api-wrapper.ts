import { InputParameters } from './input-parameters'
import { Client, resolveSpaceId, ServerTaskDetails, ServerTaskWaiter, TaskState } from '@octopusdeploy/api-client'

export interface DeploymentResult {
  serverTaskId: string
  environmentName: string
}

export async function waitForTask(client: Client, parameters: InputParameters): Promise<TaskState | undefined> {
  const spaceId = await resolveSpaceId(client, parameters.space)
  client.info(
    `🐙 waiting for task ${parameters.server}/app#/${spaceId}/tasks/${parameters.serverTaskId} in Octopus Deploy...`
  )

  const waiter = new ServerTaskWaiter(client, parameters.space)
  const serverTask = await waiter.waitForServerTaskToComplete(
    parameters.serverTaskId,
    parameters.pollingInterval * 1000,
    parameters.timeout * 1000,
    (serverTaskDetails: ServerTaskDetails) => {
      if (parameters.hideProgress !== true) {
        client.info(
          `waiting for task ${serverTaskDetails.Task.Id}. Status: ${serverTaskDetails.Task.State}. Progress: ${serverTaskDetails.Progress.ProgressPercentage}%`
        )
      }
    }
  )

  return serverTask?.State
}
