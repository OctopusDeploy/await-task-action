import { InputParameters } from './input-parameters'
import { Client, ExecutionWaiter, getServerTask, resolveSpaceId } from '@octopusdeploy/api-client'
import { ServerTaskDetails, TaskState } from '@octopusdeploy/api-client/dist/features/serverTasks'

export interface DeploymentResult {
  serverTaskId: string
  environmentName: string
}

export async function waitForTask(client: Client, parameters: InputParameters): Promise<boolean> {
  const spaceId = resolveSpaceId(client, parameters.space)
  client.info(
    `🐙 waiting for task [${parameters.serverTaskId}](${parameters.server}/app#/${spaceId}/tasks/${parameters.serverTaskId}) in Octopus Deploy...`
  )

  const waiter = new ExecutionWaiter(client, parameters.space)
  await waiter.waitForExecutionToComplete(
    [parameters.serverTaskId],
    false,
    true,
    '',
    parameters.pollingInterval,
    parameters.timeout,
    'task',
    (serverTaskDetails: ServerTaskDetails) => {
      if (parameters.hideProgress !== true) {
        client.info(
          `waiting for task ${serverTaskDetails.task.id}. Status: ${serverTaskDetails.task.state}. Progress: ${serverTaskDetails.progress.progressPercentage}%`
        )
      }
    }
  )

  const serverTask = await getServerTask(client, parameters.space, parameters.serverTaskId)
  return serverTask.state === TaskState.Success
}
