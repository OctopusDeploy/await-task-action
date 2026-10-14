import { InputParameters } from './input-parameters'
import { Client, resolveSpaceId, ServerTask, ServerTaskWaiter, TaskState } from '@octopusdeploy/api-client'

export interface DeploymentResult {
  serverTaskId: string
  environmentName: string
}

export interface TaskResult {
  state: TaskState | undefined
  task: ServerTask | undefined
  taskUrl: string
}

export function getTaskUrl(server: string, spaceId: string, serverTaskId: string): string {
  return `${server.replace(/\/+$/, '')}/app#/${spaceId}/tasks/${serverTaskId}`
}

export async function waitForTask(client: Client, parameters: InputParameters): Promise<TaskResult> {
  const spaceId = await resolveSpaceId(client, parameters.space)
  const taskUrl = getTaskUrl(parameters.server, spaceId, parameters.serverTaskId)
  client.info(`🐙 waiting for task ${taskUrl} in Octopus Deploy...`)

  const waiter = new ServerTaskWaiter(client, parameters.space)
  const serverTask = await waiter.waitForServerTaskToComplete(
    parameters.serverTaskId,
    parameters.pollingInterval * 1000,
    parameters.timeout * 1000,
    (task: ServerTask) => {
      if (parameters.hideProgress !== true) {
        client.info(`waiting for task ${task.Id}. Status: ${task.State}.`)
      }
    },
    parameters.cancelOnTimeout
  )

  return { state: serverTask?.State, task: serverTask, taskUrl }
}
