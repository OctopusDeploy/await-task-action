import { InputParameters } from './input-parameters'
import { Client, ExecutionWaiter, resolveSpaceId } from '@octopusdeploy/api-client'
import { ServerTaskDetails, TaskState } from '@octopusdeploy/api-client/dist/features/serverTasks'

export interface DeploymentResult {
  serverTaskId: string
  environmentName: string
}

export async function waitForTask(client: Client, parameters: InputParameters): Promise<boolean> {
  const spaceId = await resolveSpaceId(client, parameters.space)
  client.info(
    `🐙 waiting for task [${parameters.serverTaskId}](${parameters.server}/app#/${spaceId}/tasks/${parameters.serverTaskId}) in Octopus Deploy...`
  )

  const waiter = new ExecutionWaiter(client, parameters.space)
  const serverTask = await waiter.waitForExecutionToComplete(
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

  return serverTask?.State === TaskState.Success
}
